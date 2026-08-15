import { create } from "zustand";
import { reduceEvent, createInitialReducerState } from "./reducer.js";
import type { AppStoreState } from "./types.js";

const initial = createInitialReducerState();

export const useAppStore = create<AppStoreState>((set) => ({
  agentState: initial.agentState,
  userState: initial.userState,
  uiState: initial.uiState,
  applyEvent: (event) => {
    set((state) => {
      const next = reduceEvent(
        {
          agentState: state.agentState,
          userState: state.userState,
          uiState: state.uiState,
        },
        event,
      );
      return {
        agentState: next.agentState,
        userState: next.userState,
        uiState: next.uiState,
      };
    });
  },
}));
