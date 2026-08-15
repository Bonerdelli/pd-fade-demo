import { describe, it } from "vitest";
import { agentStateSchema } from "./state.js";
import { emptyAgentState, expectInvalid, expectValid } from "./test-helpers.js";

describe("agentStateSchema", () => {
  it("accepts a valid agent snapshot", () => {
    expectValid(agentStateSchema, emptyAgentState);
  });

  it("rejects user-namespace keys in an agent snapshot", () => {
    expectInvalid(agentStateSchema, {
      ...emptyAgentState,
      comments: [],
    });
    expectInvalid(agentStateSchema, {
      ...emptyAgentState,
      selection: ["n1"],
    });
    expectInvalid(agentStateSchema, {
      ...emptyAgentState,
      positionOverrides: { n1: { x: 0, y: 0 } },
    });
  });
});
