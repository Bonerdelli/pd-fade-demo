import { describe, it } from "vitest";
import { agentEventSchema } from "./events.js";
import { emptyAgentState, envelope, expectInvalid, expectValid } from "./test-helpers.js";

const optionalRunEnvelope = { ...envelope, runId: null };

describe("agentEventSchema union", () => {
  it("parses every event type", () => {
    expectValid(agentEventSchema, { ...envelope, type: "RUN_STARTED" });
    expectValid(agentEventSchema, { ...envelope, type: "RUN_FINISHED" });
    expectValid(agentEventSchema, { ...envelope, type: "RUN_ERROR", message: "boom" });
    expectValid(agentEventSchema, { ...envelope, type: "RUN_CANCELLED" });
    expectValid(agentEventSchema, {
      ...envelope,
      type: "TEXT_DELTA",
      messageId: "msg-1",
      delta: "hi",
    });
    expectValid(agentEventSchema, {
      ...envelope,
      type: "TOOL_START",
      toolCallId: "tc-1",
      name: "search",
    });
    expectValid(agentEventSchema, {
      ...envelope,
      type: "TOOL_ARGS",
      toolCallId: "tc-1",
      delta: "{}",
    });
    expectValid(agentEventSchema, {
      ...envelope,
      type: "TOOL_RESULT",
      toolCallId: "tc-1",
      status: "ok",
      result: {},
    });
    expectValid(agentEventSchema, {
      ...optionalRunEnvelope,
      type: "STATE_SNAPSHOT",
      snapshot: emptyAgentState,
    });
    expectValid(agentEventSchema, {
      ...optionalRunEnvelope,
      type: "STATE_DELTA",
      patch: [{ op: "add", path: "/graph/nodes/-", value: { id: "n1" } }],
    });
    expectValid(agentEventSchema, {
      ...optionalRunEnvelope,
      type: "VIEWPORT_COMMAND",
      target: "graph",
      camera: { x: 0, y: 0, zoom: 1 },
    });
    expectValid(agentEventSchema, {
      ...optionalRunEnvelope,
      type: "VIEWPORT_COMMAND",
      target: "map",
      camera: { center: [0, 0], zoom: 2 },
    });
  });

  it("rejects unknown type tags", () => {
    expectInvalid(agentEventSchema, { ...envelope, type: "UNKNOWN_EVENT" });
    expectInvalid(agentEventSchema, { ...envelope, type: "RUN_STARTED", runId: null });
  });
});
