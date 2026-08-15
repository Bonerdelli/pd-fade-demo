import { describe, it } from "vitest";
import {
  runCancelledEventSchema,
  runErrorEventSchema,
  runFinishedEventSchema,
  runStartedEventSchema,
  stateDeltaEventSchema,
  stateSnapshotEventSchema,
  textDeltaEventSchema,
  toolArgsEventSchema,
  toolResultEventSchema,
  toolStartEventSchema,
  viewportCommandEventSchema,
} from "./events.js";
import { emptyAgentState, envelope, expectInvalid, expectValid } from "./test-helpers.js";

describe("agent event schemas", () => {
  it("validates RUN_STARTED", () => {
    expectValid(runStartedEventSchema, { ...envelope, type: "RUN_STARTED" });
    expectInvalid(runStartedEventSchema, { ...envelope, type: "RUN_FINISHED" });
    expectInvalid(runStartedEventSchema, { ...envelope, type: "RUN_STARTED", seq: "1" });
  });

  it("validates RUN_FINISHED", () => {
    expectValid(runFinishedEventSchema, { ...envelope, type: "RUN_FINISHED" });
    expectInvalid(runFinishedEventSchema, { ...envelope, type: "RUN_STARTED" });
    expectInvalid(runFinishedEventSchema, { seq: 1, type: "RUN_FINISHED" });
  });

  it("validates RUN_ERROR", () => {
    expectValid(runErrorEventSchema, { ...envelope, type: "RUN_ERROR", message: "boom" });
    expectInvalid(runErrorEventSchema, { ...envelope, type: "RUN_ERROR" });
    expectInvalid(runErrorEventSchema, { ...envelope, type: "RUN_ERROR", message: 42 });
  });

  it("validates RUN_CANCELLED", () => {
    expectValid(runCancelledEventSchema, { ...envelope, type: "RUN_CANCELLED" });
    expectInvalid(runCancelledEventSchema, { ...envelope, type: "RUN_STARTED" });
    expectInvalid(runCancelledEventSchema, { type: "RUN_CANCELLED" });
  });

  it("validates TEXT_DELTA", () => {
    expectValid(textDeltaEventSchema, {
      ...envelope,
      type: "TEXT_DELTA",
      messageId: "msg-1",
      delta: "hello",
    });
    expectInvalid(textDeltaEventSchema, { ...envelope, type: "TEXT_DELTA", messageId: "msg-1" });
    expectInvalid(textDeltaEventSchema, {
      ...envelope,
      type: "TEXT_DELTA",
      messageId: "msg-1",
      delta: 1,
    });
  });

  it("validates TOOL_START", () => {
    expectValid(toolStartEventSchema, {
      ...envelope,
      type: "TOOL_START",
      toolCallId: "tc-1",
      name: "search",
    });
    expectInvalid(toolStartEventSchema, { ...envelope, type: "TOOL_START", toolCallId: "tc-1" });
    expectInvalid(toolStartEventSchema, {
      ...envelope,
      type: "TOOL_START",
      toolCallId: "tc-1",
      name: 1,
    });
  });

  it("validates TOOL_ARGS", () => {
    expectValid(toolArgsEventSchema, {
      ...envelope,
      type: "TOOL_ARGS",
      toolCallId: "tc-1",
      delta: '{"q":',
    });
    expectInvalid(toolArgsEventSchema, { ...envelope, type: "TOOL_ARGS", toolCallId: "tc-1" });
    expectInvalid(toolArgsEventSchema, {
      ...envelope,
      type: "TOOL_ARGS",
      toolCallId: "tc-1",
      delta: false,
    });
  });

  it("validates TOOL_RESULT", () => {
    expectValid(toolResultEventSchema, {
      ...envelope,
      type: "TOOL_RESULT",
      toolCallId: "tc-1",
      status: "ok",
      result: { items: [] },
    });
    expectInvalid(toolResultEventSchema, {
      ...envelope,
      type: "TOOL_RESULT",
      toolCallId: "tc-1",
      status: "ok",
    });
    expectInvalid(toolResultEventSchema, {
      ...envelope,
      type: "TOOL_RESULT",
      toolCallId: "tc-1",
      status: "pending",
      result: null,
    });
  });

  it("validates STATE_SNAPSHOT", () => {
    expectValid(stateSnapshotEventSchema, {
      ...envelope,
      type: "STATE_SNAPSHOT",
      snapshot: emptyAgentState,
    });
    expectInvalid(stateSnapshotEventSchema, { ...envelope, type: "STATE_SNAPSHOT" });
    expectInvalid(stateSnapshotEventSchema, {
      ...envelope,
      type: "STATE_SNAPSHOT",
      snapshot: { graph: {}, map: {} },
    });
  });

  it("validates STATE_DELTA", () => {
    expectValid(stateDeltaEventSchema, {
      ...envelope,
      type: "STATE_DELTA",
      patch: [{ op: "add", path: "/graph/nodes/-", value: { id: "n1" } }],
    });
    expectInvalid(stateDeltaEventSchema, { ...envelope, type: "STATE_DELTA", patch: "[]" });
    expectInvalid(stateDeltaEventSchema, {
      ...envelope,
      type: "STATE_DELTA",
      patch: [{ op: "move", path: "/x", value: 1 }],
    });
  });

  it("validates VIEWPORT_COMMAND", () => {
    expectValid(viewportCommandEventSchema, {
      ...envelope,
      type: "VIEWPORT_COMMAND",
      target: "graph",
      camera: { x: 0, y: 0, zoom: 1 },
    });
    expectValid(viewportCommandEventSchema, {
      ...envelope,
      type: "VIEWPORT_COMMAND",
      target: "map",
      camera: { center: [10, 20], zoom: 5 },
    });
    expectInvalid(viewportCommandEventSchema, {
      ...envelope,
      type: "VIEWPORT_COMMAND",
      target: "graph",
    });
    expectInvalid(viewportCommandEventSchema, {
      ...envelope,
      type: "VIEWPORT_COMMAND",
      target: "chart",
      camera: { x: 0, y: 0, zoom: 1 },
    });
  });
});
