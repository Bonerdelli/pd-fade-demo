/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectSse } from "../lib/sse.js";
import { createInitialReducerState } from "../store/reducer.js";
import { useAppStore } from "../store/index.js";
import { useSessionBootstrap } from "./use-session-bootstrap.js";

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

vi.mock("../lib/sse.js", () => ({
  connectSse: vi.fn(),
  reportInvalidSsePayload: vi.fn(),
}));

describe("useSessionBootstrap", () => {
  beforeEach(() => {
    vi.mocked(connectSse).mockClear();
    vi.mocked(connectSse).mockResolvedValue({
      disconnect: vi.fn(),
      abortStream: vi.fn(),
    });

    window.history.replaceState({}, "", "/");

    const initial = createInitialReducerState();
    useAppStore.setState({
      sessionId: null,
      agentState: initial.agentState,
      userState: initial.userState,
      chat: initial.chat,
      uiState: initial.uiState,
      retrySessionBootstrap: null,
      startNewSession: null,
    });

    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sessionState,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts a new session on demand without full page reload", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    const { unmount } = renderHook(() => useSessionBootstrap());

    await waitFor(() => {
      expect(useAppStore.getState().uiState.bootstrapStatus).toBe("ready");
    });

    expect(useAppStore.getState().sessionId).toBe("11111111-1111-1111-1111-111111111111");
    expect(connectSse).toHaveBeenCalledTimes(1);

    useAppStore.setState({
      chat: [{ kind: "user", id: "m1", text: "hello" }],
    });

    useAppStore.getState().startNewSession?.();

    await waitFor(() => {
      expect(useAppStore.getState().sessionId).toBe("22222222-2222-2222-2222-222222222222");
    });

    expect(useAppStore.getState().chat).toEqual([]);
    expect(useAppStore.getState().uiState.bootstrapStatus).toBe("ready");
    expect(useAppStore.getState().uiState.lastSeq).toBe(0);
    expect(pushStateSpy).toHaveBeenCalled();
    expect(new URL(window.location.href).searchParams.get("session")).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
    expect(connectSse).toHaveBeenCalledTimes(2);

    unmount();
  });
});
