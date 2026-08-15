import type { AgentEvent, AgentState, ChatMessage, UserState } from "@pd-fade/shared";
import type { UiState } from "./types.js";
import { emptyAgentState, emptyUserState, initialUiState } from "./types.js";

export interface ReducerState {
  agentState: AgentState;
  userState: UserState;
  chat: ChatMessage[];
  uiState: UiState;
}

export function reduceEvent(state: ReducerState, event: AgentEvent): ReducerState {
  switch (event.type) {
    case "RUN_STARTED":
      return {
        ...state,
        uiState: { ...state.uiState, runStatus: "running" },
      };
    case "RUN_FINISHED":
      return {
        ...state,
        uiState: { ...state.uiState, runStatus: "idle" },
      };
    case "RUN_ERROR":
      return {
        ...state,
        uiState: { ...state.uiState, runStatus: "error" },
      };
    case "RUN_CANCELLED":
      return {
        ...state,
        uiState: { ...state.uiState, runStatus: "cancelled" },
      };
    case "STATE_SNAPSHOT":
      return {
        ...state,
        agentState: event.snapshot,
      };
    default:
      return state;
  }
}

export function createInitialReducerState(): ReducerState {
  return {
    agentState: emptyAgentState,
    userState: emptyUserState,
    chat: [],
    uiState: initialUiState,
  };
}
