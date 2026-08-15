import {
  agentStateSchema,
  graphCameraSchema,
  mapCameraSchema,
  type AgentState,
  type GraphCamera,
  type MapCamera,
} from "@pd-fade/shared";
import {
  BERLIN_CENTER,
  LAYOUT,
  MAP_SHAPES,
  searchEntities,
  selectSignals,
} from "./dataset.js";
import {
  focusInputSchema,
  isToolName,
  plotSignalsInputSchema,
  searchEntitiesInputSchema,
  type FocusInput,
  type ToolName,
} from "./tool-schemas.js";

export type ViewportCommandIntent =
  | { target: "graph"; camera: GraphCamera }
  | { target: "map"; camera: MapCamera };

export interface ToolExecutionOutcome {
  status: "ok" | "error";
  result: unknown;
  agentState?: AgentState;
  viewportCommand?: ViewportCommandIntent;
  errorMessage?: string;
}

function toAgentMapShapes() {
  return MAP_SHAPES.map((shape) => {
    if (shape.kind === "point") {
      return {
        id: shape.id,
        kind: "point" as const,
        coordinates: shape.coordinates as [number, number],
        label: shape.label,
      };
    }

    return {
      id: shape.id,
      kind: "polygon" as const,
      coordinates: shape.coordinates as Array<Array<[number, number]>>,
      label: shape.label,
    };
  });
}

function buildSearchAgentState(previous: AgentState, searchResult: ReturnType<typeof searchEntities>) {
  return agentStateSchema.parse({
    graph: {
      nodes: searchResult.nodes,
      edges: searchResult.edges,
      layout: searchResult.layout,
    },
    map: {
      shapes: toAgentMapShapes(),
      signals: previous.map.signals,
    },
  });
}

function buildSignalsAgentState(previous: AgentState, signals: ReturnType<typeof selectSignals>) {
  return agentStateSchema.parse({
    graph: previous.graph,
    map: {
      shapes: previous.map.shapes,
      signals,
    },
  });
}

function defaultGraphCamera(entityId?: string): GraphCamera {
  if (entityId && LAYOUT[entityId]) {
    const position = LAYOUT[entityId];
    return { x: position.x - 40, y: position.y - 20, zoom: 0.9 };
  }

  return { x: -40, y: -20, zoom: 0.9 };
}

function defaultMapCamera(shapeId?: string): MapCamera {
  const shape = MAP_SHAPES.find((entry) => entry.id === shapeId);
  if (shape?.kind === "point") {
    return { center: shape.coordinates as [number, number], zoom: 13 };
  }

  return { center: BERLIN_CENTER, zoom: 12.5 };
}

function executeFocus(input: FocusInput, agentState: AgentState): ToolExecutionOutcome {
  if (input.target === "graph") {
    const camera = input.camera
      ? graphCameraSchema.parse(input.camera)
      : defaultGraphCamera(input.entityId);

    return {
      status: "ok",
      result: { target: "graph", camera },
      viewportCommand: { target: "graph", camera },
    };
  }

  const camera = input.camera
    ? mapCameraSchema.parse(input.camera)
    : defaultMapCamera(input.shapeId ?? findShapeIdForEntity(input.entityId, agentState));

  return {
    status: "ok",
    result: { target: "map", camera },
    viewportCommand: { target: "map", camera },
  };
}

function findShapeIdForEntity(entityId: string | undefined, agentState: AgentState): string | undefined {
  if (!entityId) {
    return undefined;
  }

  const shape = agentState.map.shapes.find(
    (entry) => entry.label?.toLowerCase().includes(entityId) || entry.id.includes(entityId),
  );
  return shape?.id;
}

function executeSearchEntities(input: unknown, agentState: AgentState): ToolExecutionOutcome {
  const parsed = searchEntitiesInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      result: { message: parsed.error.message },
      errorMessage: parsed.error.message,
    };
  }

  const searchResult = searchEntities(parsed.data);
  const nextState = buildSearchAgentState(agentState, searchResult);

  return {
    status: "ok",
    result: {
      entities: searchResult.entities,
      edges: searchResult.edges,
      matchCount: searchResult.matchCount,
    },
    agentState: nextState,
  };
}

function executePlotSignals(input: unknown, agentState: AgentState): ToolExecutionOutcome {
  const parsed = plotSignalsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      result: { message: parsed.error.message },
      errorMessage: parsed.error.message,
    };
  }

  const signals = selectSignals(parsed.data);
  if (signals.length === 0) {
    return {
      status: "error",
      result: { message: "No signals matched the filter" },
      errorMessage: "No signals matched the filter",
    };
  }

  const nextState = buildSignalsAgentState(agentState, signals);
  const center = parsed.data.center ?? BERLIN_CENTER;

  return {
    status: "ok",
    result: { plotted: signals.length, center },
    agentState: nextState,
  };
}

function executeFocusTool(input: unknown, agentState: AgentState): ToolExecutionOutcome {
  const parsed = focusInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      result: { message: parsed.error.message },
      errorMessage: parsed.error.message,
    };
  }

  return executeFocus(parsed.data, agentState);
}

export function executeTool(
  name: string,
  input: unknown,
  agentState: AgentState,
): ToolExecutionOutcome {
  if (!isToolName(name)) {
    return {
      status: "error",
      result: { message: `Unknown tool: ${name}` },
      errorMessage: `Unknown tool: ${name}`,
    };
  }

  switch (name as ToolName) {
    case "search_entities":
      return executeSearchEntities(input, agentState);
    case "plot_signals":
      return executePlotSignals(input, agentState);
    case "focus":
      return executeFocusTool(input, agentState);
    default:
      return {
        status: "error",
        result: { message: `Unknown tool: ${name}` },
        errorMessage: `Unknown tool: ${name}`,
      };
  }
}
