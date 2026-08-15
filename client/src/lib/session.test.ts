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

  it("connects only once after stop during in-flight fetch and restart", async () => {
    let resolveFirstFetch: ((value: unknown) => void) | undefined;
    let fetchCount = 0;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          fetchCount += 1;
          if (fetchCount === 1) {
            resolveFirstFetch = resolve;
            return;
          }
          resolve({
            ok: true,
            status: 200,
            json: async () => sessionState,
          });
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

    const firstStart = controller.start();
    controller.stop();

    resolveFirstFetch?.({
      ok: true,
      status: 200,
      json: async () => sessionState,
    });

    await firstStart;

    expect(connectSse).not.toHaveBeenCalled();

    await controller.start();

    expect(connectSse).toHaveBeenCalledTimes(1);
  });

  it("disconnects resolved handle when stop runs during connectSse await", async () => {
    const disconnect = vi.fn();
    let resolveConnect: ((handle: SseConnectionHandle) => void) | undefined;

    vi.mocked(connectSse).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConnect = resolve;
        }),
    );

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

    const startPromise = controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    controller.stop();

    resolveConnect?.({
      disconnect,
      abortStream: vi.fn(),
    });

    await startPromise;

    expect(connectSse).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith({ silent: true });
  });

  it("disconnects the existing stream before a retry start fetch completes", async () => {
    const disconnect = vi.fn();

    vi.mocked(connectSse).mockResolvedValue({
      disconnect,
      abortStream: vi.fn(),
    });

    let resolveSecondFetch: ((value: unknown) => void) | undefined;
    let fetchCount = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => sessionState,
        };
      }

      return new Promise((resolve) => {
        resolveSecondFetch = resolve;
      });
    }) as unknown as typeof fetch;

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
    expect(connectSse).toHaveBeenCalledTimes(1);

    const secondStart = controller.start();
    expect(disconnect).toHaveBeenCalledWith({ silent: true });

    resolveSecondFetch?.({
      ok: true,
      status: 200,
      json: async () => sessionState,
    });

    await secondStart;
    expect(connectSse).toHaveBeenCalledTimes(2);
  });
});
