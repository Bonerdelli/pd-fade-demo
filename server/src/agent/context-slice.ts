import type { AgentState, UserState } from "@pd-fade/shared";

function summarizeLabels(labels: string[], limit = 6): string {
  if (labels.length === 0) {
    return "none";
  }

  const head = labels.slice(0, limit);
  const suffix = labels.length > limit ? ` (+${labels.length - limit} more)` : "";
  return `${head.join(", ")}${suffix}`;
}

function resolveNodeLabels(agentState: AgentState, nodeIds: string[]): string[] {
  const labelById = new Map(agentState.graph.nodes.map((node) => [node.id, node.label]));
  return nodeIds.map((id) => labelById.get(id) ?? id);
}

function resolveShapeLabel(agentState: AgentState, userState: UserState, shapeId: string): string {
  const agentShape = agentState.map.shapes.find((shape) => shape.id === shapeId);
  if (agentShape?.label) {
    return agentShape.label;
  }

  const userShape = userState.map.shapes.find((shape) => shape.id === shapeId);
  if (userShape && "label" in userShape && userShape.label) {
    return userShape.label;
  }

  return shapeId;
}

export function buildMaterializedContextSlice(agentState: AgentState, userState: UserState): string {
  const nodeLabels = agentState.graph.nodes.map((node) => node.label);
  const shapeLabels = agentState.map.shapes.map((shape) => shape.label ?? shape.id);
  const signalLabels = agentState.map.signals.map((signal) => signal.label);

  const userShapeSummary =
    userState.map.shapes.length === 0
      ? "none"
      : userState.map.shapes
          .map((shape) => {
            const label = "label" in shape && shape.label ? shape.label : shape.id;
            return `${shape.id} (${label}, ${shape.kind})`;
          })
          .join("; ");

  const commentSummary =
    userState.comments.length === 0
      ? "none"
      : userState.comments
          .map(
            (comment) =>
              `"${comment.text}" on shape ${resolveShapeLabel(agentState, userState, comment.targetShapeId)}`,
          )
          .join("; ");

  const selectionSummary =
    userState.selection.length === 0
      ? "none"
      : summarizeLabels(resolveNodeLabels(agentState, userState.selection));

  const graphViewport = userState.viewports.graph
    ? `x=${userState.viewports.graph.x}, y=${userState.viewports.graph.y}, zoom=${userState.viewports.graph.zoom}`
    : "unset";

  const mapViewport = userState.viewports.map
    ? `center=[${userState.viewports.map.center[0]}, ${userState.viewports.map.center[1]}], zoom=${userState.viewports.map.zoom}`
    : "unset";

  const overrideSummary =
    Object.keys(userState.positionOverrides).length === 0
      ? "none"
      : Object.entries(userState.positionOverrides)
          .map(([nodeId, position]) => `${nodeId} -> (${position.x}, ${position.y})`)
          .join("; ");

  return [
    "Agent-owned state:",
    `- Graph: ${agentState.graph.nodes.length} nodes (${summarizeLabels(nodeLabels)}), ${agentState.graph.edges.length} edges`,
    `- Map shapes: ${agentState.map.shapes.length} (${summarizeLabels(shapeLabels)})`,
    `- Map signals: ${agentState.map.signals.length} (${summarizeLabels(signalLabels)})`,
  ].join("\n") +
    "\n\n" +
    [
      "User layer (read-only for you):",
      `- User shapes: ${userShapeSummary}`,
      `- Comments: ${commentSummary}`,
      `- Selection: ${selectionSummary}`,
      `- Graph viewport: ${graphViewport}`,
      `- Map viewport: ${mapViewport}`,
      `- Position overrides: ${overrideSummary}`,
    ].join("\n");
}

export function buildSystemPrompt(agentState: AgentState, userState: UserState): string {
  const contextSlice = buildMaterializedContextSlice(agentState, userState);

  return [
    "You are an assistant for a Berlin entity graph and map canvas demo.",
    "You can only change the application through registered tools: search_entities, plot_signals, focus.",
    "Chat text is for the user; never emit protocol events or raw JSON state in chat.",
    "After search_entities or plot_signals the server publishes cumulative agent snapshots — do not invent node ids or coordinates.",
    "Use focus to suggest viewport moves; it does not mutate state.",
    "When tool execution fails, read the error and retry or explain to the user.",
    "",
    "Current materialized context:",
    contextSlice,
  ].join("\n");
}
