import { useCallback } from "react";
import type { ChatMessage, UserState } from "@pd-fade/shared";
import { submitClearPositionOverrides, type MutationStore } from "../../../lib/mutations.js";
import type { MutationError } from "../../../lib/mutation-errors.js";
import { useAppStore } from "../../../store/index.js";

function createAppMutationStore(): MutationStore {
  return {
    getSessionId: () => useAppStore.getState().sessionId,
    getUserState: () => useAppStore.getState().userState,
    replaceUserState: (userState: UserState) => useAppStore.getState().replaceUserState(userState),
    appendChatMessage: (message: ChatMessage) => useAppStore.getState().appendChatMessage(message),
    removeChatMessage: (messageId: string) => useAppStore.getState().removeChatMessage(messageId),
    setMutationError: (error: MutationError | null) =>
      useAppStore.getState().setMutationError(error),
  };
}

export function useClearPositionOverrides() {
  return useCallback(() => {
    submitClearPositionOverrides(createAppMutationStore());
  }, []);
}
