import { describe, expect, it } from "vitest";
import type { UserState } from "@pd-fade/shared";
import {
  createInitialReducerState,
  foldEvents,
  hydrateFromSessionResponse,
  reduceEvent,
} from "./reducer.js";
import { emptyAgentState, emptyUserState } from "./types.js";
import {
  buildAuthoritativeMockChat,
  buildHydrateTailFromMockRun,
  emptySnapshotEvent,
  mockRunEventLog,
  mockRunId,
  populatedAgentSnapshot,
  signalsSnapshotFromMockRun,
  stateDeltaFixtureEvent,
  userStateFixture,
} from "./fixtures/mock-run.js";

describe("reduceEvent golden tests", () => {
  it("folds the realistic mock driver event log into the expected state shape", () => {
    const initial = createInitialReducerState();
    const next = foldEvents(initial, mockRunEventLog);

    expect(next.uiState.runStatus).toBe("idle");
    expect(next.uiState.currentRunId).toBeNull();
    expect(next.agentState.graph.nodes).toHaveLength(8);
    expect(next.agentState.map.signals).toHaveLength(3);
    expect(next.agentState.map.shapes).toHaveLength(3);
    expect(next.uiState.cameraCommand).toEqual({
      target: "map",
      camera: { center: [13.405, 52.52], zoom: 12.5 },
      seq: 78,
    });

    expect(next.chat.filter((message) => message.kind === "assistant")).toHaveLength(3);
    expect(next.chat.filter((message) => message.kind === "toolCall")).toHaveLength(2);
    expect(next.chat.some((message) => message.kind === "toolCall" && message.name === "search_entities")).toBe(
      true,
    );
    expect(next.chat.some((message) => message.kind === "toolCall" && message.name === "plot_signals")).toBe(
      true,
    );
    expect(next.agentState).toEqual(signalsSnapshotFromMockRun);
  });

  it("never mutates userState on STATE_SNAPSHOT", () => {
    const initial = {
      ...createInitialReducerState(),
      userState: userStateFixture as UserState,
    };
    const before = structuredClone(initial.userState);
    const next = reduceEvent(initial, emptySnapshotEvent);

    expect(next.agentState).toEqual(emptyAgentState);
    expect(next.userState).toEqual(before);
  });

  it("applies RFC 6902 patches to agentState", () => {
    const initial = {
      ...createInitialReducerState(),
      agentState: populatedAgentSnapshot,
    };

    const next = reduceEvent(initial, stateDeltaFixtureEvent);

    expect(next.agentState.graph.nodes[0]?.label).toBe("Updated");
  });

  it("tracks tool card lifecycle from start through args to result", () => {
    let state = createInitialReducerState();

    state = reduceEvent(state, {
      seq: 1,
      runId: mockRunId,
      ts: 1,
      type: "TOOL_START",
      toolCallId: "tc-1",
      name: "fetch",
    });
    expect(state.chat[0]).toMatchObject({ kind: "toolCall", status: "running", name: "fetch" });

    state = reduceEvent(state, {
      seq: 2,
      runId: mockRunId,
      ts: 2,
      type: "TOOL_ARGS",
      toolCallId: "tc-1",
      delta: '{"id":',
    });
    state = reduceEvent(state, {
      seq: 3,
      runId: mockRunId,
      ts: 3,
      type: "TOOL_ARGS",
      toolCallId: "tc-1",
      delta: '"x"}',
    });

    const toolCall = state.chat[0];
    expect(toolCall).toMatchObject({ kind: "toolCall", args: { id: "x" } });

    state = reduceEvent(state, {
      seq: 4,
      runId: mockRunId,
      ts: 4,
      type: "TOOL_RESULT",
      toolCallId: "tc-1",
      status: "error",
      result: { message: "failed" },
    });

    expect(state.chat[0]).toMatchObject({ status: "error", result: { message: "failed" } });
  });

  it("folds streaming assistant text deltas into one message", () => {
    let state = createInitialReducerState();

    state = reduceEvent(state, {
      seq: 1,
      runId: mockRunId,
      ts: 1,
      type: "TEXT_DELTA",
      messageId: "a1",
      delta: "Hel",
    });
    state = reduceEvent(state, {
      seq: 2,
      runId: mockRunId,
      ts: 2,
      type: "TEXT_DELTA",
      messageId: "a1",
      delta: "lo",
    });

    expect(state.chat).toEqual([{ kind: "assistant", id: "a1", text: "Hello" }]);
  });

  it("stores run error message and run id on RUN_ERROR", () => {
    const next = reduceEvent(createInitialReducerState(), {
      seq: 1,
      runId: mockRunId,
      ts: 1,
      type: "RUN_ERROR",
      message: "Provider unavailable",
    });

    expect(next.uiState.runStatus).toBe("error");
    expect(next.uiState.currentRunId).toBe(mockRunId);
    expect(next.uiState.runErrorMessage).toBe("Provider unavailable");
  });
});

describe("hydrateFromSessionResponse", () => {
  it("uses server chat as authoritative and still applies tail agent projections", () => {
    const authoritativeChat = buildAuthoritativeMockChat();
    const tailEvents = buildHydrateTailFromMockRun();

    const duplicated = foldEvents(
      {
        ...createInitialReducerState(),
        agentState: emptyAgentState,
        userState: emptyUserState,
        chat: authoritativeChat,
        uiState: createInitialReducerState().uiState,
      },
      tailEvents,
    );

    const hydrated = hydrateFromSessionResponse({
      snapshot: emptyAgentState,
      userState: emptyUserState,
      chat: authoritativeChat,
      tailEvents: [
        ...tailEvents,
        {
          seq: 136,
          runId: mockRunId,
          ts: 1,
          type: "RUN_FINISHED",
        },
      ],
      lastSeq: 136,
    });

    expect(duplicated.chat.length).toBeGreaterThanOrEqual(authoritativeChat.length);
    const duplicatedSummary = duplicated.chat.find(
      (message) => message.kind === "assistant" && message.id.includes("assistant-summary"),
    );
    if (duplicatedSummary?.kind === "assistant") {
      const authoritativeSummary = authoritativeChat.find(
        (message) => message.kind === "assistant" && message.id.includes("assistant-summary"),
      );
      if (authoritativeSummary?.kind === "assistant") {
        expect(duplicatedSummary.text.length).toBeGreaterThan(authoritativeSummary.text.length);
      }
    }

    expect(hydrated.chat).toEqual(authoritativeChat);
    expect(hydrated.uiState.runStatus).toBe("idle");
    expect(hydrated.agentState).toEqual(emptyAgentState);
  });
});
