import type { AgentEvent, AgentState } from "@pd-fade/shared";
import { emptyAgentState } from "../types.js";

export const mockRunId = "run-mock-1";
export const mockBaseTs = 1_700_000_000_000;

export const populatedAgentSnapshot: AgentState = {
  graph: {
    nodes: [{ id: "n1", label: "Alpha", kind: "entity" }],
    edges: [],
    layout: { n1: { x: 10, y: 20 } },
  },
  map: {
    shapes: [
      {
        id: "shape-1",
        kind: "point",
        coordinates: [12.5, 55.7],
        label: "HQ",
      },
    ],
    signals: [],
  },
};

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
  comments: [{ id: "c1", targetShapeId: "shape-1", text: "Looks good" }],
  positionOverrides: { n1: { x: 99, y: 88 } },
  selection: ["n1"],
  viewports: {
    graph: { x: 0, y: 0, zoom: 1 },
    map: { center: [12.5, 55.7] as [number, number], zoom: 10 },
  },
};

export const mockRunEventLog: AgentEvent[] = [
  {
    seq: 1,
    runId: mockRunId,
    ts: mockBaseTs,
    type: "RUN_STARTED",
  },
  {
    seq: 2,
    runId: mockRunId,
    ts: mockBaseTs + 1,
    type: "TEXT_DELTA",
    messageId: "assistant-1",
    delta: "Hello ",
  },
  {
    seq: 3,
    runId: mockRunId,
    ts: mockBaseTs + 2,
    type: "TEXT_DELTA",
    messageId: "assistant-1",
    delta: "world",
  },
  {
    seq: 4,
    runId: mockRunId,
    ts: mockBaseTs + 3,
    type: "TOOL_START",
    toolCallId: "tool-1",
    name: "searchGraph",
  },
  {
    seq: 5,
    runId: mockRunId,
    ts: mockBaseTs + 4,
    type: "TOOL_ARGS",
    toolCallId: "tool-1",
    delta: '{"query":"alpha"}',
  },
  {
    seq: 6,
    runId: mockRunId,
    ts: mockBaseTs + 5,
    type: "TOOL_RESULT",
    toolCallId: "tool-1",
    status: "ok",
    result: { matches: 1 },
  },
  {
    seq: 7,
    runId: null,
    ts: mockBaseTs + 6,
    type: "STATE_SNAPSHOT",
    snapshot: populatedAgentSnapshot,
  },
  {
    seq: 8,
    runId: null,
    ts: mockBaseTs + 7,
    type: "STATE_DELTA",
    patch: [
      {
        op: "add",
        path: "/graph/nodes/-",
        value: { id: "n2", label: "Beta", kind: "entity" },
      },
    ],
  },
  {
    seq: 9,
    runId: null,
    ts: mockBaseTs + 8,
    type: "VIEWPORT_COMMAND",
    target: "graph",
    camera: { x: 100, y: 200, zoom: 1.5 },
  },
  {
    seq: 10,
    runId: mockRunId,
    ts: mockBaseTs + 9,
    type: "RUN_FINISHED",
  },
];

export const emptySnapshotEvent: AgentEvent = {
  seq: 99,
  runId: null,
  ts: mockBaseTs,
  type: "STATE_SNAPSHOT",
  snapshot: emptyAgentState,
};
