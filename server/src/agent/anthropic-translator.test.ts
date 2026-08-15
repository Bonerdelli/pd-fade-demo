import type { MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { agentStateSchema } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database.js";
import { SessionStore } from "../db/session-store.js";
import { AnthropicStreamTranslator } from "./anthropic-translator.js";
import {
  focusToolStreamEvents,
  searchEntitiesToolStreamEvents,
} from "./anthropic-stream-fixtures.js";
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

    const streamEvents = searchEntitiesToolStreamEvents(
      "toolu_search",
      '{"query":"berlin","kinds":["company"]}',
    );

    const { emitted, agentState, translator } = await collectTranslatorEvents(
      streamEvents,
      initialAgentState,
    );

    const types = emitted.map((event) => event.type);
    expect(types).toEqual([
      "TEXT_DELTA",
      "TOOL_START",
      "TOOL_ARGS",
      "TOOL_RESULT",
      "STATE_SNAPSHOT",
    ]);

    expect(emitted[0]).toMatchObject({
      type: "TEXT_DELTA",
      messageId: "run-translator-assistant",
      delta: "Searching",
    });

    expect(emitted[1]).toMatchObject({
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

    const { emitted } = await collectTranslatorEvents(
      focusToolStreamEvents("toolu_focus"),
      initialAgentState,
    );

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
