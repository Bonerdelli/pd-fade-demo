import { describe, expect, it, vi } from "vitest";
import { computeBackoffDelayMs, connectSse, createSseActivityWatchdog, parseSseChunk } from "./sse.js";

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
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

describe("parseSseChunk", () => {
  it("parses id and data frames", () => {
    const first = parseSseChunk('id: 5\ndata: {"seq":5,"type":"RUN_STARTED"}\n\n');
    expect(first.events).toEqual([
      { id: "5", data: '{"seq":5,"type":"RUN_STARTED"}' },
    ]);
    expect(first.remainder).toBe("");
  });

  it("handles events split across chunks", () => {
    const part1 = parseSseChunk("id: 1\nda");
    expect(part1.events).toEqual([]);
    expect(part1.remainder).toBe("id: 1\nda");

    const part2 = parseSseChunk(`${part1.remainder}ta: {"seq":1}\n\nid: 2\ndata: {"seq":2}\n\n`);
    expect(part2.events).toEqual([
      { id: "1", data: '{"seq":1}' },
      { id: "2", data: '{"seq":2}' },
    ]);
  });

  it("ignores heartbeat comment lines", () => {
    const parsed = parseSseChunk(': heartbeat\n\nid: 3\ndata: {"ok":true}\n\n');
    expect(parsed.events).toEqual([{ id: "3", data: '{"ok":true}' }]);
  });

  it("joins multiline data fields", () => {
    const parsed = parseSseChunk('data: line1\ndata: line2\n\n');
    expect(parsed.events).toEqual([{ id: null, data: "line1\nline2" }]);
  });
});

describe("connectSse", () => {
  function createSingleUseFetch(chunks: string[]) {
    let used = false;
    return vi.fn(async () => {
      if (used) {
        return new Promise<Response>(() => undefined);
      }
      used = true;
      return {
        ok: true,
        status: 200,
        body: createStream(chunks),
      } as Response;
    }) as unknown as typeof fetch;
  }

  it("drops invalid JSON without crashing the stream", async () => {
    const onEvent = vi.fn();
    const onInvalidPayload = vi.fn();
    const abortController = new AbortController();

    const fetchImpl = createSingleUseFetch([
      'id: 1\ndata: {"seq":1,"runId":"r1","ts":1,"type":"RUN_STARTED"}\n\n',
      "id: 2\ndata: not-json\n\n",
      'id: 3\ndata: {"seq":2,"runId":"r1","ts":2,"type":"RUN_FINISHED"}\n\n',
    ]);

    const connection = await connectSse({
      url: "/events",
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent,
      onInvalidPayload,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    expect(onInvalidPayload).toHaveBeenCalledTimes(1);
    abortController.abort();
    connection.disconnect();
  });

  it("triggers resync callback on seq gap", async () => {
    const onGapDetected = vi.fn();
    const onEvent = vi.fn();
    const abortController = new AbortController();

    const fetchImpl = createSingleUseFetch([
      'id: 1\ndata: {"seq":1,"runId":"r1","ts":1,"type":"RUN_STARTED"}\n\n',
      'id: 5\ndata: {"seq":5,"runId":"r1","ts":5,"type":"RUN_FINISHED"}\n\n',
    ]);

    await connectSse({
      url: "/events",
      lastEventId: 0,
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent,
      onGapDetected,
    });

    await vi.waitFor(() => {
      expect(onGapDetected).toHaveBeenCalledWith(1, 5);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    abortController.abort();
  });

  it("triggers cursor-ahead callback when the server rejects a stale cursor", async () => {
    const onCursorAhead = vi.fn();
    const abortController = new AbortController();

    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 409,
      body: null,
    })) as unknown as typeof fetch;

    await connectSse({
      url: "/events",
      lastEventId: 100,
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent: vi.fn(),
      onCursorAhead,
    });

    await vi.waitFor(() => {
      expect(onCursorAhead).toHaveBeenCalledTimes(1);
    });

    abortController.abort();
  });

  it("silently drops duplicate and old seq values", async () => {
    const onEvent = vi.fn();
    const abortController = new AbortController();

    const fetchImpl = createSingleUseFetch([
      'id: 2\ndata: {"seq":2,"runId":"r1","ts":2,"type":"RUN_STARTED"}\n\n',
      'id: 2\ndata: {"seq":2,"runId":"r1","ts":2,"type":"RUN_STARTED"}\n\n',
      'id: 1\ndata: {"seq":1,"runId":"r1","ts":1,"type":"RUN_STARTED"}\n\n',
    ]);

    const connection = await connectSse({
      url: "/events",
      lastEventId: 1,
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(1);
    });

    abortController.abort();
    connection.disconnect();
  });

  it("supports silent disconnect without emitting down status", async () => {
    const onConnectionStatusChange = vi.fn();
    const abortController = new AbortController();

    const fetchImpl = createSingleUseFetch([
      'id: 1\ndata: {"seq":1,"runId":"r1","ts":1,"type":"RUN_STARTED"}\n\n',
    ]);

    const connection = await connectSse({
      url: "/events",
      fetchImpl,
      signal: abortController.signal,
      sleep: async () => undefined,
      onEvent: vi.fn(),
      onConnectionStatusChange,
    });

    await vi.waitFor(() => {
      expect(onConnectionStatusChange).toHaveBeenCalledWith("connected");
    });

    onConnectionStatusChange.mockClear();
    connection.disconnect({ silent: true });

    expect(onConnectionStatusChange).not.toHaveBeenCalled();
    abortController.abort();
  });
});

describe("computeBackoffDelayMs", () => {
  it("caps backoff at ten seconds with jitter", () => {
    expect(computeBackoffDelayMs(0, () => 0)).toBeGreaterThanOrEqual(500);
    expect(computeBackoffDelayMs(10, () => 1)).toBeLessThanOrEqual(10_000);
  });
});

describe("createSseActivityWatchdog", () => {
  it("fires after the configured silence window", () => {
    vi.useFakeTimers();

    try {
      const onStalled = vi.fn();
      const watchdog = createSseActivityWatchdog({
        timeoutMs: 1_000,
        onStalled,
      });

      watchdog.touch();
      vi.advanceTimersByTime(999);
      expect(onStalled).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onStalled).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets the silence window on touch", () => {
    vi.useFakeTimers();

    try {
      const onStalled = vi.fn();
      const watchdog = createSseActivityWatchdog({
        timeoutMs: 1_000,
        onStalled,
      });

      watchdog.touch();
      vi.advanceTimersByTime(800);
      watchdog.touch();
      vi.advanceTimersByTime(800);
      expect(onStalled).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(onStalled).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears a pending timeout", () => {
    vi.useFakeTimers();

    try {
      const onStalled = vi.fn();
      const watchdog = createSseActivityWatchdog({
        timeoutMs: 500,
        onStalled,
      });

      watchdog.touch();
      watchdog.clear();
      vi.advanceTimersByTime(500);
      expect(onStalled).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("connectSse stall integration", () => {
  it("treats heartbeat comment bytes as stream activity", async () => {
    vi.useFakeTimers();

    try {
      const onStreamStalled = vi.fn();
      const onEvent = vi.fn();
      let fetchCount = 0;
      const fetchImpl = vi.fn(async () => {
        fetchCount += 1;
        if (fetchCount > 1) {
          return new Promise<Response>(() => undefined);
        }
      return {
        ok: true,
        status: 200,
        body: createStream([
          ": heartbeat\n\n",
          ": heartbeat\n\n",
          'id: 1\ndata: {"seq":1,"runId":"r1","ts":1,"type":"RUN_STARTED"}\n\n',
        ]),
      } as Response;
    }) as unknown as typeof fetch;

      const abortController = new AbortController();
      const connection = await connectSse({
        url: "/events",
        fetchImpl,
        signal: abortController.signal,
        stallTimeoutMs: 100,
        sleep: async () => undefined,
        onEvent,
        onStreamStalled,
      });

      await vi.waitFor(() => {
        expect(onEvent).toHaveBeenCalledTimes(1);
      });

      vi.advanceTimersByTime(150);
      expect(onStreamStalled).not.toHaveBeenCalled();

      connection.disconnect();
      abortController.abort();
    } finally {
      vi.useRealTimers();
    }
  });
});
