import { agentStateSchema, type AgentState } from "@pd-fade/shared";
import {
  delay,
  emitTextDeltas,
  emitToolCall,
  type AgentDriver,
  type AgentRunContext,
  type EmitFn,
} from "./driver.js";

const BERLIN_CENTER: [number, number] = [13.405, 52.52];

const ENTITIES = [
  { id: "company-techberlin", label: "TechBerlin GmbH", kind: "company" },
  { id: "company-spree", label: "Spree Ventures", kind: "company" },
  { id: "person-anna", label: "Anna Schmidt", kind: "person" },
  { id: "person-max", label: "Max Weber", kind: "person" },
  { id: "loc-brandenburg", label: "Brandenburg Gate", kind: "location" },
  { id: "loc-alexanderplatz", label: "Alexanderplatz", kind: "location" },
  { id: "loc-mitte", label: "Mitte District", kind: "location" },
  { id: "loc-kreuzberg", label: "Kreuzberg District", kind: "location" },
] as const;

const EDGES = [
  { id: "e1", source: "person-anna", target: "company-techberlin", label: "CEO" },
  { id: "e2", source: "person-max", target: "company-spree", label: "Partner" },
  { id: "e3", source: "company-techberlin", target: "loc-mitte", label: "HQ" },
  { id: "e4", source: "company-spree", target: "loc-kreuzberg", label: "Office" },
  { id: "e5", source: "person-anna", target: "person-max", label: "Advisor" },
  { id: "e6", source: "loc-brandenburg", target: "loc-mitte", label: "Landmark" },
] as const;

const LAYOUT: Record<string, { x: number; y: number }> = {
  "company-techberlin": { x: 0, y: 0 },
  "company-spree": { x: 280, y: 40 },
  "person-anna": { x: -120, y: -80 },
  "person-max": { x: 420, y: -60 },
  "loc-brandenburg": { x: -80, y: 160 },
  "loc-alexanderplatz": { x: 120, y: 200 },
  "loc-mitte": { x: 40, y: 120 },
  "loc-kreuzberg": { x: 320, y: 180 },
};

function buildSearchSnapshot(previous: AgentState): AgentState {
  const snapshot = agentStateSchema.parse({
    graph: {
      nodes: ENTITIES.map((entity) => ({
        id: entity.id,
        label: entity.label,
        kind: entity.kind,
      })),
      edges: EDGES.map((edge) => ({ ...edge })),
      layout: { ...LAYOUT },
    },
    map: {
      shapes: [
        {
          id: "shape-mitte",
          kind: "polygon" as const,
          coordinates: [
            [
              [13.38, 52.53],
              [13.42, 52.53],
              [13.42, 52.51],
              [13.38, 52.51],
              [13.38, 52.53],
            ],
          ],
          label: "Mitte",
        },
        {
          id: "shape-kreuzberg",
          kind: "polygon" as const,
          coordinates: [
            [
              [13.4, 52.49],
              [13.44, 52.49],
              [13.44, 52.47],
              [13.4, 52.47],
              [13.4, 52.49],
            ],
          ],
          label: "Kreuzberg",
        },
        {
          id: "shape-hq",
          kind: "point" as const,
          coordinates: [13.405, 52.52] as [number, number],
          label: "TechBerlin HQ",
        },
      ],
      signals: previous.map.signals,
    },
  });

  return snapshot;
}

function buildSignalsSnapshot(previous: AgentState): AgentState {
  const signals = [
    {
      id: "signal-1",
      coordinates: [13.3777, 52.5163] as [number, number],
      label: "Brandenburg Gate activity",
      strength: 0.82,
    },
    {
      id: "signal-2",
      coordinates: [13.4134, 52.5219] as [number, number],
      label: "Alexanderplatz traffic",
      strength: 0.67,
    },
    {
      id: "signal-3",
      coordinates: [13.405, 52.498] as [number, number],
      label: "Kreuzberg cluster",
      strength: 0.74,
    },
  ];

  return agentStateSchema.parse({
    graph: previous.graph,
    map: {
      shapes: previous.map.shapes,
      signals,
    },
  });
}

export class MockAgentDriver implements AgentDriver {
  async run(context: AgentRunContext, emit: EmitFn): Promise<void> {
    const { runId, userMessage, signal } = context;
    let agentState = context.agentState;

    await emit({ type: "RUN_STARTED", runId });

    const intro =
      `I'll analyze your request about "${userMessage}" and explore the Berlin entity graph. ` +
      "Let me search the knowledge base first.";
    const assistantMessageId = `${runId}-assistant`;
    await emitTextDeltas(emit, runId, assistantMessageId, intro, signal);

    await emitToolCall(
      emit,
      runId,
      `${runId}-tool-search`,
      "search_entities",
      { query: userMessage, kinds: ["company", "person", "location"], city: "Berlin" },
      {
        entities: ENTITIES,
        edges: EDGES,
        matchCount: ENTITIES.length,
      },
      signal,
    );

    agentState = buildSearchSnapshot(agentState);
    await delay(50, signal);
    await emit({
      type: "STATE_SNAPSHOT",
      runId,
      snapshot: agentState,
    });

    await delay(40, signal);
    await emit({
      type: "VIEWPORT_COMMAND",
      runId,
      target: "graph",
      camera: {
        x: -40,
        y: -20,
        zoom: 0.9,
      },
    });

    const mid =
      "Found eight related entities across companies, people and locations. " +
      "Plotting geo signals next.";
    await emitTextDeltas(emit, runId, `${runId}-assistant-mid`, mid, signal);

    await emitToolCall(
      emit,
      runId,
      `${runId}-tool-plot`,
      "plot_signals",
      { signalIds: ["signal-1", "signal-2", "signal-3"], center: BERLIN_CENTER },
      { plotted: 3, center: BERLIN_CENTER },
      signal,
    );

    agentState = buildSignalsSnapshot(agentState);
    await delay(50, signal);
    await emit({
      type: "STATE_SNAPSHOT",
      runId,
      snapshot: agentState,
    });

    await delay(40, signal);
    await emit({
      type: "VIEWPORT_COMMAND",
      runId,
      target: "map",
      camera: {
        center: BERLIN_CENTER,
        zoom: 12.5,
      },
    });

    const summary =
      "Mapped three activity signals around central Berlin and linked eight entities in the graph. " +
      "TechBerlin GmbH and Spree Ventures anchor the company layer with people and district locations connected.";
    await emitTextDeltas(emit, runId, `${runId}-assistant-summary`, summary, signal);

    await emit({ type: "RUN_FINISHED", runId });
  }
}

export function createAgentDriver(driverName: string): AgentDriver {
  if (driverName === "mock") {
    return new MockAgentDriver();
  }

  throw new Error(`Unsupported agent driver: ${driverName}`);
}
