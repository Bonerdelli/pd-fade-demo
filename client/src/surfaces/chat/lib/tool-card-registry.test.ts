// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  resolveToolCardDefinition,
  toolCardHasExpandableDetails,
  TOOL_CARD_REGISTRY,
} from "../tools/tool-card-registry.js";

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

describe("toolCardHasExpandableDetails", () => {
  it("treats completed plot_signals as non-expandable without debug center detail", () => {
    expect(
      toolCardHasExpandableDetails(
        "plot_signals",
        { kind: "parsed", value: { signalIds: ["s1"], center: [13.4, 52.5] } },
        "ok",
        { plotted: 1 },
        false,
      ),
    ).toBe(false);
  });

  it("allows plot_signals expansion when debug mode exposes center", () => {
    expect(
      toolCardHasExpandableDetails(
        "plot_signals",
        { kind: "parsed", value: { signalIds: ["s1"], center: [13.4, 52.5] } },
        "ok",
        { plotted: 1 },
        true,
      ),
    ).toBe(true);
  });

  it("allows search_entities expansion for parsed args", () => {
    expect(
      toolCardHasExpandableDetails(
        "search_entities",
        { kind: "parsed", value: { query: "berlin" } },
        "ok",
        { matchCount: 1 },
        false,
      ),
    ).toBe(true);
  });

  it("allows fallback expansion for errors and debug raw args", () => {
    expect(
      toolCardHasExpandableDetails(
        "mystery_tool",
        { kind: "parsed", value: { payload: true } },
        "error",
        { message: "boom" },
        false,
      ),
    ).toBe(true);

    expect(
      toolCardHasExpandableDetails(
        "mystery_tool",
        { kind: "parsed", value: { payload: true } },
        "ok",
        { ok: true },
        true,
      ),
    ).toBe(true);

    expect(
      toolCardHasExpandableDetails(
        "mystery_tool",
        { kind: "parsed", value: { payload: true } },
        "ok",
        { ok: true },
        false,
      ),
    ).toBe(false);
  });
});
