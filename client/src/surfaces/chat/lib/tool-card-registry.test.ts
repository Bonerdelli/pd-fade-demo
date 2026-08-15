// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveToolCardDefinition, TOOL_CARD_REGISTRY } from "../tools/tool-card-registry.js";

describe("resolveToolCardDefinition", () => {
  it("returns designed cards for known tools with parsed args", () => {
    const definition = resolveToolCardDefinition("search_entities", {
      kind: "parsed",
      value: { query: "berlin" },
    });

    expect(definition).toBe(TOOL_CARD_REGISTRY.search_entities);
  });

  it("falls back for unknown tool names", () => {
    const definition = resolveToolCardDefinition("unknown_tool", {
      kind: "parsed",
      value: { foo: "bar" },
    });

    expect(definition).not.toBe(TOOL_CARD_REGISTRY.search_entities);
    expect(definition).not.toBe(TOOL_CARD_REGISTRY.plot_signals);
  });

  it("falls back when args are invalid even for known tools", () => {
    const definition = resolveToolCardDefinition("search_entities", {
      kind: "invalid",
      raw: "{broken",
    });

    expect(definition).not.toBe(TOOL_CARD_REGISTRY.search_entities);
  });
});
