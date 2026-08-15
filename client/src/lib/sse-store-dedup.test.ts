import type { AgentEvent } from "@pd-fade/shared";
import { describe, expect, it, vi } from "vitest";
import { connectSse } from "./sse.js";
import { useAppStore } from "../store/index.js";
import { createInitialReducerState } from "../store/reducer.js";

function formatSseEvent(event: AgentEvent): string {
  return `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
}

function createStreamFromText(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode(chunks[index]));
      index += 1;
    },
  });
}

describe("connectSse with shared store", () => {
  it("does not double-apply text when two transports deliver the same events", async () => {
    const events: AgentEvent[] = [
      { seq: 1, runId: "run-1", ts: 1, type: "RUN_STARTED" },
      { seq: 2, runId: "run-1", ts: 2, type: "TEXT_DELTA", messageId: "a1", delta: "Mapped " },
      { seq: 3, runId: "run-1", ts: 3, type: "TEXT_DELTA", messageId: "a1", delta: "three " },
      { seq: 4, runId: "run-1", ts: 4, type: "TEXT_DELTA", messageId: "a1", delta: "signals" },
      { seq: 5, runId: "run-1", ts: 5, type: "RUN_FINISHED" },
    ];

    const payload = events.map(formatSseEvent).join("");
    const initial = createInitialReducerState();
    useAppStore.setState({
      ...initial,
      uiState: { ...initial.uiState, bootstrapStatus: "ready", lastSeq: 0 },
    });

    const applyEvent = (event: AgentEvent) => useAppStore.getState().applyEvent(event);

    let fetchCount = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCount += 1;
      if (fetchCount > 2) {
        return new Promise<Response>(() => undefined);
      }
      return {
        ok: true,
        status: 200,
        body: createStreamFromText([payload]),
      } as Response;
    }) as unknown as typeof fetch;

    const abortA = new AbortController();
    const abortB = new AbortController();

    const connectionA = await connectSse({
      url: "/events-a",
      fetchImpl,
      signal: abortA.signal,
      sleep: async () => undefined,
      onEvent: applyEvent,
    });

    const connectionB = await connectSse({
      url: "/events-b",
      fetchImpl,
      signal: abortB.signal,
      sleep: async () => undefined,
      onEvent: applyEvent,
    });

    await vi.waitFor(() => {
      expect(useAppStore.getState().chat.some((message) => message.kind === "assistant")).toBe(true);
    });

    const assistant = useAppStore.getState().chat.find((message) => message.kind === "assistant");
    expect(assistant?.kind === "assistant" ? assistant.text : "").toBe("Mapped three signals");

    abortA.abort();
    abortB.abort();
    connectionA.disconnect();
    connectionB.disconnect();
  });
});
