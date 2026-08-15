import type { AgentState, UserState } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { buildMaterializedContextSlice } from "./context-slice.js";
import { composeSystemPrompt } from "./system-prompt.js";

const emptyAgentState: AgentState = {
  graph: { nodes: [], edges: [], layout: {} },
  map: { shapes: [], signals: [] },
};

const emptyUserState: UserState = {
  map: { shapes: [] },
  comments: [],
  positionOverrides: {},
  selection: [],
  viewports: { graph: null, map: null },
};

describe("composeSystemPrompt", () => {
  it("includes tool names, cumulative semantics, and the materialized context slice", () => {
    const contextSlice = buildMaterializedContextSlice(emptyAgentState, emptyUserState);
    const prompt = composeSystemPrompt(contextSlice);

    expect(prompt).toContain("search_entities");
    expect(prompt).toContain("plot_signals");
    expect(prompt).toContain("focus");
    expect(prompt).toContain("repeated searches accumulate");
    expect(prompt).toContain("Each call adds matching signals");
    expect(prompt).toContain("Current materialized context:");
    expect(prompt).toContain("Agent-owned state:");
    expect(prompt).toContain("User layer (read-only for you):");
    expect(prompt).toContain(contextSlice);
  });
});
