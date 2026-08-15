import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@pd-fade/shared";
import { useAppStore } from "./index.js";
import { createInitialReducerState } from "./reducer.js";

describe("useAppStore applyEvent", () => {
  it("ignores events with seq less than or equal to the last applied seq", () => {
    const initial = createInitialReducerState();
    useAppStore.setState({
      ...initial,
      uiState: {
        ...initial.uiState,
        lastSeq: 3,
        bootstrapStatus: "ready",
      },
    });

    const duplicate: AgentEvent = {
      seq: 3,
      runId: "run-1",
      ts: 1,
      type: "TEXT_DELTA",
      messageId: "assistant-1",
      delta: "dup",
    };

    useAppStore.getState().applyEvent(duplicate);

    expect(useAppStore.getState().chat).toEqual([]);
    expect(useAppStore.getState().uiState.lastSeq).toBe(3);

    useAppStore.getState().applyEvent({
      seq: 4,
      runId: "run-1",
      ts: 2,
      type: "TEXT_DELTA",
      messageId: "assistant-1",
      delta: "Mapped ",
    });

    expect(useAppStore.getState().chat).toEqual([
      { kind: "assistant", id: "assistant-1", text: "Mapped " },
    ]);

    useAppStore.getState().applyEvent({
      seq: 4,
      runId: "run-1",
      ts: 2,
      type: "TEXT_DELTA",
      messageId: "assistant-1",
      delta: "Mapped ",
    });

    expect(useAppStore.getState().chat).toEqual([
      { kind: "assistant", id: "assistant-1", text: "Mapped " },
    ]);
  });
});
