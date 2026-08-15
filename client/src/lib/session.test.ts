import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSessionController } from "./session.js";
import type { SseConnectionHandle } from "./sse.js";

const sessionState = {
  snapshot: { graph: { nodes: [], edges: [], layout: {} }, map: { shapes: [], signals: [] } },
  userState: {
    map: { shapes: [] },
    comments: [],
    positionOverrides: {},
    selection: [],
    viewports: { graph: null, map: null },
  },
  chat: [],
  tailEvents: [],
  lastSeq: 0,
};

vi.mock("./sse.js", () => ({
  connectSse: vi.fn(),
  reportInvalidSsePayload: vi.fn(),
}));

import { connectSse } from "./sse.js";

describe("createSessionController", () => {
  beforeEach(() => {
    vi.mocked(connectSse).mockClear();
  });

  it("wires onStreamStalled to abort the stream and mark reconnecting", async () => {
    const setConnectionStatus = vi.fn();
    const abortStream = vi.fn();
    let capturedOnStreamStalled: (() => void) | undefined;

    vi.mocked(connectSse).mockImplementation(async (options) => {
      capturedOnStreamStalled = options.onStreamStalled;
      return { disconnect: vi.fn(), abortStream } satisfies SseConnectionHandle;
    });

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sessionState,
    })) as unknown as typeof fetch;

    const controller = createSessionController({
      getSessionId: () => "session-1",
      setSessionId: vi.fn(),
      setBootstrapStatus: vi.fn(),
      setConnectionStatus,
      hydrateSession: vi.fn(),
      applyEvent: vi.fn(),
      getLastSeq: () => 0,
      fetchImpl,
    });

    await controller.start();

    expect(capturedOnStreamStalled).toBeTypeOf("function");

    capturedOnStreamStalled?.();

    expect(setConnectionStatus).toHaveBeenCalledWith("reconnecting");
    expect(abortStream).toHaveBeenCalledTimes(1);

    controller.stop();
  });

  it("does not connect after stop invalidates an in-flight start", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    vi.mocked(connectSse).mockResolvedValue({
      disconnect: vi.fn(),
      abortStream: vi.fn(),
    });

    const controller = createSessionController({
      getSessionId: () => "session-1",
      setSessionId: vi.fn(),
      setBootstrapStatus: vi.fn(),
      setConnectionStatus: vi.fn(),
      hydrateSession: vi.fn(),
      applyEvent: vi.fn(),
      getLastSeq: () => 0,
      fetchImpl,
    });

    const startPromise = controller.start();
    controller.stop();

    resolveFetch?.({
      ok: true,
      status: 200,
      json: async () => sessionState,
    });

    await startPromise;

    expect(connectSse).not.toHaveBeenCalled();
  });

  it("disconnects the previous stream before opening a replacement", async () => {
    const disconnectFirst = vi.fn();
    const disconnectSecond = vi.fn();

    vi.mocked(connectSse)
      .mockResolvedValueOnce({
        disconnect: disconnectFirst,
        abortStream: vi.fn(),
      })
      .mockResolvedValueOnce({
        disconnect: disconnectSecond,
        abortStream: vi.fn(),
      });

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sessionState,
    })) as unknown as typeof fetch;

    const controller = createSessionController({
      getSessionId: () => "session-1",
      setSessionId: vi.fn(),
      setBootstrapStatus: vi.fn(),
      setConnectionStatus: vi.fn(),
      hydrateSession: vi.fn(),
      applyEvent: vi.fn(),
      getLastSeq: () => 0,
      fetchImpl,
    });

    await controller.start();
    await controller.start();

    expect(connectSse).toHaveBeenCalledTimes(2);
    expect(disconnectFirst).toHaveBeenCalledTimes(1);

    controller.stop();
    expect(disconnectSecond).toHaveBeenCalledTimes(1);
  });
});
