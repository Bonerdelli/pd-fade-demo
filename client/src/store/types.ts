import type { AgentEvent, AgentState, ChatMessage, UserState } from "@pd-fade/shared";

export type RunStatus = "idle" | "running" | "error" | "cancelled";

export interface UiState {
  runStatus: RunStatus;
  activeCanvasTab: "graph" | "map";
}

export interface AppStoreState {
  agentState: AgentState;
  userState: UserState;
  chat: ChatMessage[];
  uiState: UiState;
  applyEvent: (event: AgentEvent) => void;
  setActiveCanvasTab: (tab: "graph" | "map") => void;
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
