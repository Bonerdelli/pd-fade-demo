import type { AgentGraphState } from "./types.js";

export interface Point2D {
  x: number;
  y: number;
}

export function fallbackPosition(index: number): Point2D {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: column * 220, y: row * 140 };
}

export function getEffectiveNodePosition(
  nodeId: string,
  index: number,
  layout: AgentGraphState["layout"],
  overrides: Record<string, Point2D>,
): Point2D {
  const override = overrides[nodeId];
  if (override) {
    return override;
  }

  const agentPosition = layout[nodeId];
  if (agentPosition) {
    return agentPosition;
  }

  return fallbackPosition(index);
}

export function hasLayoutDivergence(
  overrides: Record<string, Point2D>,
  layout: AgentGraphState["layout"],
): boolean {
  for (const [nodeId, override] of Object.entries(overrides)) {
    const agentPosition = layout[nodeId];
    if (!agentPosition) {
      return true;
    }
    if (override.x !== agentPosition.x || override.y !== agentPosition.y) {
      return true;
    }
  }
  return false;
}
