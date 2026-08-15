import type { AgentEvent } from "@pd-fade/shared";
import { describe, expect, it, vi } from "vitest";
import { createInitialReducerState, foldEvents, hydrateFromSessionResponse } from "../store/reducer.js";
import { connectSse } from "./sse.js";

const runId = "run-chaos";

const uninterruptedEvents: AgentEvent[] = [
  { seq: 1, runId, ts: 1, type: "RUN_STARTED" },
  { seq: 2, runId, ts: 2, type: "TEXT_DELTA", messageId: "a1", delta: "Hello" },
  {
    seq: 3,
    runId,
    ts: 3,
    type: "TOOL_START",
    toolCallId: "tc-1",
    name: "search_entities",
  },
  { seq: 4, runId, ts: 4, type: "TOOL_ARGS", toolCallId: "tc-1", delta: '{"query":"berlin"}' },
  {
    seq: 5,
    runId,
    ts: 5,
    type: "TOOL_RESULT",
    toolCallId: "tc-1",
    status: "ok",
    result: { matchCount: 2 },
  },
  { seq: 6, runId, ts: 6, type: "TEXT_DELTA", messageId: "a2", delta: "Done" },
  { seq: 7, runId, ts: 7, type: "RUN_FINISHED" },
];

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

function foldAllEvents(events: AgentEvent[]) {
  return foldEvents(createInitialReducerState(), events);
}

describe("SSE transport chaos", () => {
  it("converges after a mid-run disconnect and Last-Event-ID resume", async () => {
    const uninterrupted = foldAllEvents(uninterruptedEvents);
    const resumedEvents: AgentEvent[] = [];
    let fetchCount = 0;

    const fetchImpl = vi.fn(async (_url, init) => {
      fetchCount += 1;
      if (fetchCount > 2) {
        return new Promise<Response>(() => undefined);
      }

      const headers = (init as RequestInit | undefined)?.headers as Record<string, string> | undefined;
      const resumeAfter = headers?.["Last-Event-ID"] ? Number(headers["Last-Event-ID"]) : 0;
      const remaining = uninterruptedEvents.filter((event) => event.seq > resumeAfter);

      if (fetchCount === 1) {
        const firstChunk = remaining.slice(0, 3).map(formatSseEvent).join("");
        return {
          ok: true,
          status: 200,
          body: createStreamFromText([firstChunk]),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        body: createStreamFromText(remaining.map(formatSseEvent)),
      } as Response;
    }) as unknown as typeof fetch;

    const abortController = new AbortController();
    const connection = await connectSse({
      url: "/events",
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent: (event) => {
        resumedEvents.push(event);
      },
    });

    await vi.waitFor(() => {
      expect(resumedEvents.at(-1)?.type).toBe("RUN_FINISHED");
    });

    const resumed = foldAllEvents(resumedEvents);
    expect(resumed.uiState).toEqual(uninterrupted.uiState);
    expect(resumed.chat).toEqual(uninterrupted.chat);
    expect(fetchCount).toBeGreaterThan(1);

    abortController.abort();
    connection.disconnect();
  });

  it("drops duplicate seq delivery without changing folded state", async () => {
    const accepted: AgentEvent[] = [];
    let fetchCount = 0;

    const fetchImpl = vi.fn(async () => {
      fetchCount += 1;
      if (fetchCount > 1) {
        return new Promise<Response>(() => undefined);
      }
      return {
        ok: true,
        status: 200,
        body: createStreamFromText([
          formatSseEvent(uninterruptedEvents[0]!),
          formatSseEvent(uninterruptedEvents[0]!),
          formatSseEvent(uninterruptedEvents[1]!),
        ]),
      } as Response;
    }) as unknown as typeof fetch;

    const abortController = new AbortController();
    const connection = await connectSse({
      url: "/events",
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent: (event) => {
        accepted.push(event);
      },
    });

    await vi.waitFor(() => {
      expect(accepted).toHaveLength(2);
    });

    expect(accepted.map((event) => event.seq)).toEqual([1, 2]);
    expect(foldAllEvents(accepted).chat).toEqual(foldAllEvents(uninterruptedEvents.slice(0, 2)).chat);

    abortController.abort();
    connection.disconnect();
  });

  it("triggers resync on seq gap and converges after hydrate-style replay", async () => {
    const onGapDetected = vi.fn();
    const accepted: AgentEvent[] = [];
    let fetchCount = 0;

    const fetchImpl = vi.fn(async () => {
      fetchCount += 1;
      if (fetchCount > 1) {
        return new Promise<Response>(() => undefined);
      }
      return {
        ok: true,
        status: 200,
        body: createStreamFromText([
          formatSseEvent(uninterruptedEvents[0]!),
          formatSseEvent(uninterruptedEvents[4]!),
        ]),
      } as Response;
    }) as unknown as typeof fetch;

    const abortController = new AbortController();
    await connectSse({
      url: "/events",
      lastEventId: 0,
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent: (event) => {
        accepted.push(event);
      },
      onGapDetected,
    });

    await vi.waitFor(() => {
      expect(onGapDetected).toHaveBeenCalledWith(1, 5);
    });

    expect(accepted).toEqual([uninterruptedEvents[0]]);

    const uninterrupted = foldAllEvents(uninterruptedEvents);

    const resyncBody = {
      snapshot: createInitialReducerState().agentState,
      userState: createInitialReducerState().userState,
      chat: uninterrupted.chat,
      tailEvents: uninterruptedEvents,
      lastSeq: uninterruptedEvents.at(-1)!.seq,
    };

    const hydrated = hydrateFromSessionResponse(resyncBody);

    expect(hydrated.uiState.runStatus).toBe(uninterrupted.uiState.runStatus);
    expect(hydrated.chat).toEqual(uninterrupted.chat);

    abortController.abort();
  });
});
