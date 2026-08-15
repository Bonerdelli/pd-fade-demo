import { describe, expect, it, vi } from "vitest";
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
});
