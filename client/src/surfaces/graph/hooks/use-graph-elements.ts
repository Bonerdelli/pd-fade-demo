import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { AgentGraphState } from "../lib/types.js";
import { getEffectiveNodePosition } from "../lib/positions.js";

export interface EntityNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
}

const ENTITY_NODE_TYPE = "entity";

export function useGraphElements(
  graph: AgentGraphState,
  positionOverrides: Record<string, { x: number; y: number }>,
  selection: string[],
) {
  const nodes = useMemo<Node<EntityNodeData>[]>(() => {
    return graph.nodes.map((node, index) => {
      const position = getEffectiveNodePosition(
        node.id,
        index,
        graph.layout,
        positionOverrides,
      );

      return {
        id: node.id,
        type: ENTITY_NODE_TYPE,
        position,
        selected: selection.includes(node.id),
        data: {
          label: node.label,
          kind: node.kind,
        },
      };
    });
  }, [graph.layout, graph.nodes, positionOverrides, selection]);

  const edges = useMemo<Edge[]>(() => {
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#64748b", strokeWidth: 1.5 },
      labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    }));
  }, [graph.edges]);

  return { nodes, edges, nodeTypesKey: ENTITY_NODE_TYPE };
}

export { ENTITY_NODE_TYPE };
