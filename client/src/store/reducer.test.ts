import { describe, expect, it } from "vitest";
import type { UserState } from "@pd-fade/shared";
import {
  createInitialReducerState,
  foldEvents,
  reduceEvent,
} from "./reducer.js";
import { emptyAgentState } from "./types.js";
import {
  emptySnapshotEvent,
  mockRunEventLog,
  mockRunId,
  populatedAgentSnapshot,
  userStateFixture,
} from "./fixtures/mock-run.js";

describe("reduceEvent golden tests", () => {
  it("folds a full mock run event log into the expected state shape", () => {
    const initial = createInitialReducerState();
    const next = foldEvents(initial, mockRunEventLog);

    expect(next.uiState.runStatus).toBe("idle");
    expect(next.uiState.currentRunId).toBeNull();
    expect(next.agentState.graph.nodes).toHaveLength(2);
    expect(next.agentState.graph.nodes[1]).toEqual({
      id: "n2",
      label: "Beta",
      kind: "entity",
    });
    expect(next.agentState.map.shapes[0]?.label).toBe("HQ");
    expect(next.uiState.cameraCommand).toEqual({
      target: "graph",
      camera: { x: 100, y: 200, zoom: 1.5 },
      seq: 9,
    });

    expect(next.chat).toEqual([
      { kind: "assistant", id: "assistant-1", text: "Hello world" },
      {
        kind: "toolCall",
        id: "tool-1",
        toolCallId: "tool-1",
        name: "searchGraph",
        status: "ok",
        args: { query: "alpha" },
        result: { matches: 1 },
      },
    ]);
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

    const next = reduceEvent(initial, {
      seq: 20,
      runId: null,
      ts: 1,
      type: "STATE_DELTA",
      patch: [
        {
          op: "replace",
          path: "/graph/nodes/0/label",
          value: "Updated",
        },
      ],
    });

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
