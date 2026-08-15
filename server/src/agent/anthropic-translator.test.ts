import type { MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { agentStateSchema } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database.js";
import { SessionStore } from "../db/session-store.js";
import { AnthropicStreamTranslator } from "./anthropic-translator.js";
import type { AppendEventInput } from "../db/session-store.js";

async function collectTranslatorEvents(
  streamEvents: MessageStreamEvent[],
  initialAgentState: ReturnType<SessionStore["getAgentState"]>,
) {
  const emitted: AppendEventInput[] = [];
  let agentState = initialAgentState;

  const translator = new AnthropicStreamTranslator(
    "run-translator",
    async (event) => {
      emitted.push(event);
    },
    new AbortController().signal,
    () => agentState,
    (nextState) => {
      agentState = nextState;
    },
    0,
  );

  for (const event of streamEvents) {
    await translator.handleStreamEvent(event);
  }

  return { emitted, agentState, translator };
}

describe("AnthropicStreamTranslator", () => {
  it("maps text and tool_use stream chunks to protocol events with execution", async () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const initialAgentState = store.getAgentState("translator-session");

    const streamEvents: MessageStreamEvent[] = [
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "", citations: null },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Searching" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " Berlin" },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "tool_use",
          id: "toolu_search",
          name: "search_entities",
          input: {},
        },
      },
      {
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"query":"berlin"' },
      },
      {
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: ',"kinds":["company"]}' },
      },
      { type: "content_block_stop", index: 1 },
      {
        type: "message_delta",
        delta: {
          stop_reason: "tool_use",
          stop_sequence: null,
          container: null,
          stop_details: null,
        },
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    ];

    const { emitted, agentState, translator } = await collectTranslatorEvents(
      streamEvents,
      initialAgentState,
    );

    const types = emitted.map((event) => event.type);
    expect(types).toEqual([
      "TEXT_DELTA",
      "TEXT_DELTA",
      "TOOL_START",
      "TOOL_ARGS",
      "TOOL_ARGS",
      "TOOL_RESULT",
      "STATE_SNAPSHOT",
    ]);

    expect(emitted[0]).toMatchObject({
      type: "TEXT_DELTA",
      messageId: "run-translator-assistant",
      delta: "Searching",
    });

    expect(emitted[2]).toMatchObject({
      type: "TOOL_START",
      toolCallId: "toolu_search",
      name: "search_entities",
    });

    const snapshotEvent = emitted.find((event) => event.type === "STATE_SNAPSHOT");
    expect(snapshotEvent).toBeDefined();
    agentStateSchema.parse(agentState);
    expect(agentState.graph.nodes.length).toBeGreaterThan(0);

    expect(translator.getStopReason()).toBe("tool_use");
    expect(translator.getCompletedToolUses()).toHaveLength(1);

    db.close();
  });

  it("emits viewport command for focus tool without snapshot", async () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const initialAgentState = store.getAgentState("focus-translator");

    const streamEvents: MessageStreamEvent[] = [
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_focus",
          name: "focus",
          input: {},
        },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"target":"map"}' },
      },
      { type: "content_block_stop", index: 0 },
    ];

    const { emitted } = await collectTranslatorEvents(streamEvents, initialAgentState);

    expect(emitted.map((event) => event.type)).toEqual([
      "TOOL_START",
      "TOOL_ARGS",
      "TOOL_RESULT",
      "VIEWPORT_COMMAND",
    ]);
    expect(emitted.at(-1)).toMatchObject({ type: "VIEWPORT_COMMAND", target: "map" });

    db.close();
  });
});
