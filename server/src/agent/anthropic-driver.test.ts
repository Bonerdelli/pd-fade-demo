import type Anthropic from "@anthropic-ai/sdk";
import type { Message, MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "../db/database.js";
import { SessionStore } from "../db/session-store.js";
import type { AppendEventInput } from "../db/session-store.js";
import { AnthropicAgentDriver } from "./anthropic-driver.js";
import {
  buildAssistantMessage,
  endTurnTextStreamEvents,
  plotSignalsErrorStreamEvents,
  searchEntitiesToolStreamEvents,
  toolUseContentBlock,
} from "./anthropic-stream-fixtures.js";
import { RunCancelledError } from "./driver.js";

class FakeMessageStream {
  aborted = false;
  private readonly abortWaiters = new Set<() => void>();

  constructor(
    private readonly events: MessageStreamEvent[],
    private readonly finalAssistantMessage: Message,
    private readonly hangAfterEvents?: number,
  ) {}

  abort(): void {
    this.aborted = true;
    for (const wake of this.abortWaiters) {
      wake();
    }
    this.abortWaiters.clear();
  }

  async finalMessage(): Promise<Message> {
    if (this.aborted) {
      throw new Error("Stream aborted");
    }
    return this.finalAssistantMessage;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<MessageStreamEvent> {
    for (let index = 0; index < this.events.length; index += 1) {
      if (this.aborted) {
        throw new Error("Stream aborted");
      }

      yield this.events[index]!;

      if (this.hangAfterEvents === index) {
        await new Promise<void>((resolve, reject) => {
          if (this.aborted) {
            reject(new Error("Stream aborted"));
            return;
          }

          const wake = () => {
            this.abortWaiters.delete(wake);
            if (this.aborted) {
              reject(new Error("Stream aborted"));
              return;
            }
            resolve();
          };

          this.abortWaiters.add(wake);
        });
      }
    }
  }
}

function createMockClient(streams: FakeMessageStream[]) {
  let callIndex = 0;

  const stream = vi.fn(() => {
    const next = streams[callIndex];
    if (!next) {
      throw new Error(`Unexpected stream call ${callIndex + 1}`);
    }
    callIndex += 1;
    return next;
  });

  return {
    client: { messages: { stream } } as unknown as Anthropic,
    stream,
    getCallCount: () => callIndex,
  };
}

async function runDriver(
  client: Anthropic,
  options: {
    signal?: AbortSignal;
    userMessage?: string;
  } = {},
) {
  const db = createDatabase(":memory:");
  const store = new SessionStore(db);
  const emitted: AppendEventInput[] = [];
  const driver = new AnthropicAgentDriver(client);

  const runPromise = driver.run(
    {
      sessionId: "driver-session",
      runId: "run-driver",
      userMessage: options.userMessage ?? "explore berlin",
      userState: store.getUserState("driver-session"),
      agentState: store.getAgentState("driver-session"),
      signal: options.signal ?? new AbortController().signal,
    },
    async (event) => {
      emitted.push(event);
    },
  );

  return { runPromise, emitted, db };
}

describe("AnthropicAgentDriver", () => {
  it("runs a multi-turn agentic loop and emits the full protocol sequence", async () => {
    const toolCallId = "toolu_search";
    const turnOneStream = new FakeMessageStream(
      searchEntitiesToolStreamEvents(toolCallId, '{"query":"berlin","kinds":["company"]}'),
      buildAssistantMessage([toolUseContentBlock(toolCallId, "search_entities")], "tool_use"),
    );
    const turnTwoStream = new FakeMessageStream(
      endTurnTextStreamEvents("Done exploring."),
      buildAssistantMessage([{ type: "text", text: "Done exploring.", citations: null }], "end_turn"),
    );

    const { client, stream, getCallCount } = createMockClient([turnOneStream, turnTwoStream]);
    const { runPromise, emitted, db } = await runDriver(client);

    await runPromise;

    expect(getCallCount()).toBe(2);
    expect(stream).toHaveBeenCalledTimes(2);

    const types = emitted.map((event) => event.type);
    expect(types).toEqual([
      "RUN_STARTED",
      "TEXT_DELTA",
      "TOOL_START",
      "TOOL_ARGS",
      "TOOL_RESULT",
      "STATE_SNAPSHOT",
      "TEXT_DELTA",
      "RUN_FINISHED",
    ]);

    expect(emitted.find((event) => event.type === "TOOL_RESULT")).toMatchObject({
      status: "ok",
      toolCallId,
    });

    db.close();
  });

  it("aborts the SDK stream promptly when the run signal is cancelled", async () => {
    const events = searchEntitiesToolStreamEvents("toolu_hang", '{"query":"berlin"}');
    const hangingStream = new FakeMessageStream(
      events,
      buildAssistantMessage([toolUseContentBlock("toolu_hang", "search_entities")], "tool_use"),
      1,
    );

    const { client } = createMockClient([hangingStream]);
    const abortController = new AbortController();
    const { runPromise, emitted, db } = await runDriver(client, {
      signal: abortController.signal,
    });

    await vi.waitFor(() => {
      expect(emitted.some((event) => event.type === "TEXT_DELTA")).toBe(true);
    });

    abortController.abort();

    await expect(runPromise).rejects.toBeInstanceOf(RunCancelledError);
    expect(hangingStream.aborted).toBe(true);
    expect(emitted.some((event) => event.type === "RUN_FINISHED")).toBe(false);

    db.close();
  });

  it("feeds executor errors back to the model and continues the loop", async () => {
    const errorToolId = "toolu_plot_error";
    const turnOneStream = new FakeMessageStream(
      plotSignalsErrorStreamEvents(errorToolId),
      buildAssistantMessage([toolUseContentBlock(errorToolId, "plot_signals")], "tool_use"),
    );
    const turnTwoStream = new FakeMessageStream(
      endTurnTextStreamEvents("Retry complete."),
      buildAssistantMessage([{ type: "text", text: "Retry complete.", citations: null }], "end_turn"),
    );

    const { client, getCallCount } = createMockClient([turnOneStream, turnTwoStream]);
    const { runPromise, emitted, db } = await runDriver(client);

    await runPromise;

    expect(getCallCount()).toBe(2);

    const errorResult = emitted.find(
      (event) => event.type === "TOOL_RESULT" && event.toolCallId === errorToolId,
    );
    expect(errorResult).toMatchObject({ status: "error" });
    expect(emitted.at(-1)).toMatchObject({ type: "RUN_FINISHED" });

    db.close();
  });

  it("rethrows API stream failures without emitting RUN_FINISHED", async () => {
    const failingStream = {
      aborted: false,
      abort() {
        this.aborted = true;
      },
      finalMessage: vi.fn(),
      async *[Symbol.asyncIterator]() {
        yield searchEntitiesToolStreamEvents("toolu_fail", '{"query":"berlin"}')[0]!;
        throw new Error("Anthropic API unavailable");
      },
    };

    const { client } = createMockClient([failingStream as unknown as FakeMessageStream]);
    const { runPromise, emitted, db } = await runDriver(client);

    await expect(runPromise).rejects.toThrow(/Anthropic API unavailable/);

    const runStartedIndex = emitted.findIndex((event) => event.type === "RUN_STARTED");
    const failureIndex = emitted.length;
    expect(runStartedIndex).toBeGreaterThanOrEqual(0);
    expect(emitted.slice(failureIndex).some((event) => event.type === "RUN_FINISHED")).toBe(false);

    db.close();
  });

  it("passes the run AbortSignal to the SDK stream request options", async () => {
    const turnStream = new FakeMessageStream(
      endTurnTextStreamEvents("Hi"),
      buildAssistantMessage([{ type: "text", text: "Hi", citations: null }], "end_turn"),
    );

    const { client, stream } = createMockClient([turnStream]);
    const abortController = new AbortController();
    const { runPromise, db } = await runDriver(client, { signal: abortController.signal });

    await runPromise;

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ messages: expect.any(Array) }),
      expect.objectContaining({ signal: abortController.signal }),
    );

    db.close();
  });
});
