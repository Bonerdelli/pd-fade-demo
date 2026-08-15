import type { AgentEvent, AgentState, SessionStateResponse } from "@pd-fade/shared";
import mockRunEvents from "./mock-run-events.json";
import { emptyAgentState } from "../types.js";

export const mockRunId = "run-mock-1";

export const mockRunEventLog = mockRunEvents as AgentEvent[];

export const searchSnapshotFromMockRun = (
  mockRunEventLog.find((event) => event.type === "STATE_SNAPSHOT" && event.seq === 46) as
    | Extract<AgentEvent, { type: "STATE_SNAPSHOT" }>
    | undefined
)?.snapshot;

export const signalsSnapshotFromMockRun = (
  mockRunEventLog.find((event) => event.type === "STATE_SNAPSHOT" && event.seq === 77) as
    | Extract<AgentEvent, { type: "STATE_SNAPSHOT" }>
    | undefined
)?.snapshot;

export const userStateFixture = {
  map: {
    shapes: [
      {
        id: "user-shape-1",
        kind: "polygon" as const,
        coordinates: [
          [
            [12.4, 55.6] as [number, number],
            [12.6, 55.6] as [number, number],
            [12.5, 55.8] as [number, number],
            [12.4, 55.6] as [number, number],
          ],
        ],
      },
    ],
  },
  comments: [
    { id: "c1", targetShapeId: "shape-mitte", text: "Looks good" },
    { id: "c2", targetShapeId: "user-shape-1", text: "Keep this" },
  ],
  positionOverrides: { "company-techberlin": { x: 99, y: 88 } },
  selection: ["company-techberlin"],
  viewports: {
    graph: { x: 0, y: 0, zoom: 1 },
    map: { center: [13.405, 52.52] as [number, number], zoom: 10 },
  },
};

export const populatedAgentSnapshot: AgentState = signalsSnapshotFromMockRun ?? emptyAgentState;

export const stateDeltaFixtureEvent: AgentEvent = {
  seq: 200,
  runId: null,
  ts: 1,
  type: "STATE_DELTA",
  patch: [
    {
      op: "replace",
      path: "/graph/nodes/0/label",
      value: "Updated",
    },
  ],
};

export const emptySnapshotEvent: AgentEvent = {
  seq: 99,
  runId: null,
  ts: 1,
  type: "STATE_SNAPSHOT",
  snapshot: emptyAgentState,
};

export function buildHydrateTailFromMockRun(): AgentEvent[] {
  return mockRunEventLog.filter((event) =>
    ["TEXT_DELTA", "TOOL_START", "TOOL_ARGS", "TOOL_RESULT"].includes(event.type),
  );
}

export function buildAuthoritativeMockChat(): SessionStateResponse["chat"] {
  return [
    { kind: "user", id: "user-1", text: "show berlin" },
    {
      kind: "assistant",
      id: `${mockRunId}-assistant`,
      text:
        'I\'ll analyze your request about "show berlin" and explore the Berlin entity graph. Let me search the knowledge base first.',
    },
    {
      kind: "toolCall",
      id: `${mockRunId}-tool-search`,
      toolCallId: `${mockRunId}-tool-search`,
      name: "search_entities",
      status: "ok",
      args: { query: "show berlin", kinds: ["company", "person", "location"], city: "Berlin" },
      result: { entities: [], edges: [], matchCount: 8 },
    },
    {
      kind: "assistant",
      id: `${mockRunId}-assistant-mid`,
      text:
        "Found eight related entities across companies, people and locations. Plotting geo signals next.",
    },
    {
      kind: "toolCall",
      id: `${mockRunId}-tool-plot`,
      toolCallId: `${mockRunId}-tool-plot`,
      name: "plot_signals",
      status: "ok",
      args: { signalIds: ["signal-1", "signal-2", "signal-3"], center: [13.405, 52.52] },
      result: { plotted: 3, center: [13.405, 52.52] },
    },
    {
      kind: "assistant",
      id: `${mockRunId}-assistant-summary`,
      text:
        "Mapped three activity signals around central Berlin and linked eight entities in the graph. TechBerlin GmbH and Spree Ventures anchor the company layer with people and district locations connected.",
    },
  ];
}
