import type { AgentEvent, AgentState, UserState } from "@pd-fade/shared";

export type RunStatus = "idle" | "running" | "error" | "cancelled";

export interface UiState {
  runStatus: RunStatus;
  activeCanvasTab: "graph" | "map";
}

export interface AppStoreState {
  agentState: AgentState;
  userState: UserState;
  uiState: UiState;
  applyEvent: (event: AgentEvent) => void;
}

export const emptyAgentState: AgentState = {
  graph: {
    nodes: [],
    edges: [],
    layout: {},
  },
  map: {
    shapes: [],
    signals: [],
  },
};

export const emptyUserState: UserState = {
  map: {
    shapes: [],
  },
  comments: [],
  positionOverrides: {},
  selection: [],
  viewports: {
    graph: null,
    map: null,
  },
};

export const initialUiState: UiState = {
  runStatus: "idle",
  activeCanvasTab: "graph",
};
