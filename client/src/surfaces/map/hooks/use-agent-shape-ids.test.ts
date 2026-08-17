import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { MapShape } from "@pd-fade/shared";
import { useAppStore } from "../../../store/index.js";
import { emptyAgentState } from "../../../store/types.js";
import { useAgentShapeIds } from "./use-agent-shape-ids.js";

const agentShape: MapShape = {
  id: "hq",
  kind: "point",
  label: "TechBerlin HQ",
  coordinates: [13.405, 52.52],
};

describe("useAgentShapeIds", () => {
  beforeEach(() => {
    useAppStore.setState({
      agentState: emptyAgentState,
    });
  });

  it("returns a referentially stable Set while agent shapes stay the same", () => {
    const { result, rerender } = renderHook(() => useAgentShapeIds());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.size).toBe(0);
  });

  it("rebuilds the Set when agent shape ids change", () => {
    const { result } = renderHook(() => useAgentShapeIds());
    const first = result.current;

    act(() => {
      const current = useAppStore.getState();
      useAppStore.setState({
        agentState: {
          ...current.agentState,
          map: {
            ...current.agentState.map,
            shapes: [agentShape],
          },
        },
      });
    });

    expect(result.current).not.toBe(first);
    expect(result.current.has("hq")).toBe(true);
  });
});
