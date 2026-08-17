import { useMemo } from "react";
import { useAppStore } from "../../../store/index.js";

export function useAgentShapeIds(): Set<string> {
  const shapes = useAppStore((state) => state.agentState.map.shapes);
  return useMemo(() => new Set(shapes.map((shape) => shape.id)), [shapes]);
}
