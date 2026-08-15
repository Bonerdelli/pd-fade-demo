import { create } from "zustand";
import type { AgentEvent, ChatMessage, SessionStateResponse, UserState } from "@pd-fade/shared";
import { createInitialReducerState, hydrateFromSessionResponse, reduceEvent } from "./reducer.js";
import type { MutationError } from "../lib/mutation-errors.js";
import type { AppStoreState, BootstrapStatus, ConnectionStatus, ViewportTarget } from "./types.js";

const initial = createInitialReducerState();

function toReducerSlice(state: AppStoreState) {
  return {
    agentState: state.agentState,
    userState: state.userState,
    chat: state.chat,
    uiState: state.uiState,
  };
}

export const useAppStore = create<AppStoreState>((set) => ({
  sessionId: null,
  agentState: initial.agentState,
  userState: initial.userState,
  chat: initial.chat,
  uiState: initial.uiState,

  applyEvent: (event: AgentEvent) => {
    set((state) => {
      const next = reduceEvent(toReducerSlice(state), event);
      return {
        agentState: next.agentState,
        userState: next.userState,
        chat: next.chat,
        uiState: {
          ...next.uiState,
          lastSeq: Math.max(state.uiState.lastSeq, event.seq),
        },
      };
    });
  },

  hydrateSession: (response: SessionStateResponse) => {
    const hydrated = hydrateFromSessionResponse(response);

    set({
      agentState: hydrated.agentState,
      userState: hydrated.userState,
      chat: hydrated.chat,
      uiState: {
        ...hydrated.uiState,
        bootstrapStatus: "ready",
        lastSeq: response.lastSeq,
      },
    });
  },

  setActiveCanvasTab: (tab: ViewportTarget) => {
    set((state) => ({
      uiState: { ...state.uiState, activeCanvasTab: tab },
    }));
  },

  setBootstrapStatus: (status: BootstrapStatus) => {
    set((state) => ({
      uiState: { ...state.uiState, bootstrapStatus: status },
    }));
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set((state) => ({
      uiState: { ...state.uiState, connectionStatus: status },
    }));
  },

  setSessionId: (sessionId: string) => {
    set({ sessionId });
  },

  setMutationError: (error: MutationError | null) => {
    set((state) => ({
      uiState: { ...state.uiState, mutationError: error },
    }));
  },

  replaceUserState: (userState: UserState) => {
    set({ userState });
  },

  appendChatMessage: (message: ChatMessage) => {
    set((state) => ({
      chat: [...state.chat, message],
    }));
  },

  removeChatMessage: (messageId: string) => {
    set((state) => ({
      chat: state.chat.filter((message) => message.id !== messageId),
    }));
  },

  retrySessionBootstrap: null,

  setRetrySessionBootstrap: (retry) => {
    set({ retrySessionBootstrap: retry });
  },
}));

export function selectRunLock(state: AppStoreState): boolean {
  return state.uiState.runStatus === "running";
}
