import { describe, expect, it } from "vitest";
import { reduceEvent, createInitialReducerState } from "./reducer.js";

describe("reduceEvent", () => {
  it("marks the run as running on RUN_STARTED", () => {
    const state = createInitialReducerState();
    const next = reduceEvent(state, {
      seq: 1,
      runId: "run-1",
      ts: 1,
      type: "RUN_STARTED",
    });

    expect(next.uiState.runStatus).toBe("running");
  });
});
