import { describe, expect, it } from "vitest";
import {
  fallbackPosition,
  getEffectiveNodePosition,
  hasLayoutDivergence,
} from "./positions.js";

describe("getEffectiveNodePosition", () => {
  const layout = {
    n1: { x: 10, y: 20 },
    n2: { x: 30, y: 40 },
  };

  it("prefers user overrides over agent layout", () => {
    expect(
      getEffectiveNodePosition("n1", 0, layout, {
        n1: { x: 99, y: 88 },
      }),
    ).toEqual({ x: 99, y: 88 });
  });

  it("falls back to agent layout when no override exists", () => {
    expect(getEffectiveNodePosition("n2", 1, layout, {})).toEqual({ x: 30, y: 40 });
  });

  it("uses grid fallback when neither override nor layout exists", () => {
    expect(getEffectiveNodePosition("missing", 5, layout, {})).toEqual(fallbackPosition(5));
  });
});

describe("hasLayoutDivergence", () => {
  const layout = {
    n1: { x: 0, y: 0 },
    n2: { x: 100, y: 50 },
  };

  it("returns false when overrides match agent layout", () => {
    expect(
      hasLayoutDivergence(
        {
          n1: { x: 0, y: 0 },
        },
        layout,
      ),
    ).toBe(false);
  });

  it("returns true when an override differs from agent layout", () => {
    expect(
      hasLayoutDivergence(
        {
          n2: { x: 120, y: 50 },
        },
        layout,
      ),
    ).toBe(true);
  });

  it("returns true when override exists for a node without agent layout", () => {
    expect(
      hasLayoutDivergence(
        {
          orphan: { x: 1, y: 2 },
        },
        layout,
      ),
    ).toBe(true);
  });
});
