import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@pd-fade/shared";
import { startSseReplaySession } from "./sse-replay.js";

describe("startSseReplaySession", () => {
  it("delivers events appended between subscribe and replay", () => {
    const delivered: AgentEvent[] = [];
    const replayStarted: AgentEvent = {
      seq: 1,
      runId: "run-1",
      ts: 1,
      type: "RUN_STARTED",
    };
    const liveDuringReplay: AgentEvent = {
      seq: 2,
      runId: "run-1",
      ts: 2,
      type: "TEXT_DELTA",
      messageId: "m1",
      delta: "hi",
    };
    const liveAfterReplay: AgentEvent = {
      seq: 3,
      runId: "run-1",
      ts: 3,
      type: "RUN_FINISHED",
    };

    let listener: ((event: AgentEvent) => void) | undefined;
    const { unsubscribe } = startSseReplaySession(
      0,
      () => {
        listener?.(liveDuringReplay);
        return [replayStarted];
      },
      (onEvent) => {
        listener = onEvent;
        return () => {
          listener = undefined;
        };
      },
      (event) => delivered.push(event),
    );

    listener?.(liveAfterReplay);
    unsubscribe();

    expect(delivered.map((event) => event.seq)).toEqual([1, 2, 3]);
  });

  it("drops buffered events already covered by replay", () => {
    const delivered: AgentEvent[] = [];
    const replayEvent: AgentEvent = {
      seq: 5,
      runId: "run-1",
      ts: 1,
      type: "RUN_STARTED",
    };
    const duplicateBuffered: AgentEvent = {
      seq: 5,
      runId: "run-1",
      ts: 2,
      type: "RUN_STARTED",
    };

    let listener: ((event: AgentEvent) => void) | undefined;
    startSseReplaySession(
      4,
      () => {
        listener?.(duplicateBuffered);
        return [replayEvent];
      },
      (onEvent) => {
        listener = onEvent;
        return () => undefined;
      },
      (event) => delivered.push(event),
    );

    expect(delivered).toEqual([replayEvent]);
  });
});
