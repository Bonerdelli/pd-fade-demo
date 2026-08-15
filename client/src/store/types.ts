import type {
  AgentEvent,
  AgentState,
  ChatMessage,
  GraphCamera,
  MapCamera,
  SessionStateResponse,
  UserState,
} from "@pd-fade/shared";
import type { MutationError } from "../lib/mutation-errors.js";

export type RunStatus = "idle" | "running" | "error" | "cancelled";

export type BootstrapStatus = "loading" | "ready" | "error";

export type ConnectionStatus = "connected" | "reconnecting" | "down";

export type ViewportTarget = "graph" | "map";

export interface CameraCommand {
  target: ViewportTarget;
  camera: GraphCamera | MapCamera;
  seq: number;
}

export interface UiState {
  runStatus: RunStatus;
  activeCanvasTab: ViewportTarget;
  currentRunId: string | null;
  runErrorMessage: string | null;
  runErrorReasonCode: string | null;
  cameraCommand: CameraCommand | null;
  bootstrapStatus: BootstrapStatus;
  connectionStatus: ConnectionStatus;
  mutationError: MutationError | null;
  lastSeq: number;
}

export interface AppStoreState {
  sessionId: string | null;
  agentState: AgentState;
  userState: UserState;
  chat: ChatMessage[];
  uiState: UiState;
  applyEvent: (event: AgentEvent) => void;
  hydrateSession: (response: SessionStateResponse) => void;
  setActiveCanvasTab: (tab: ViewportTarget) => void;
  setBootstrapStatus: (status: BootstrapStatus) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSessionId: (sessionId: string) => void;
  setMutationError: (error: MutationError | null) => void;
  replaceUserState: (userState: UserState) => void;
  appendChatMessage: (message: ChatMessage) => void;
  removeChatMessage: (messageId: string) => void;
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
  currentRunId: null,
  runErrorMessage: null,
  runErrorReasonCode: null,
  cameraCommand: null,
  bootstrapStatus: "loading",
  connectionStatus: "down",
  mutationError: null,
  lastSeq: 0,
};
