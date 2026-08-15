import { useEffect, useMemo } from "react";
import { createMutationController } from "../lib/mutations.js";
import { useAppStore } from "../store/index.js";

export function useMutations() {
  const sessionId = useAppStore((state) => state.sessionId);

  const controller = useMemo(
    () =>
      createMutationController({
        getSessionId: () => useAppStore.getState().sessionId,
        getUserState: () => useAppStore.getState().userState,
        replaceUserState: (userState) => useAppStore.getState().replaceUserState(userState),
        appendChatMessage: (message) => useAppStore.getState().appendChatMessage(message),
        removeChatMessage: (messageId) => useAppStore.getState().removeChatMessage(messageId),
        setMutationError: (message) => useAppStore.getState().setMutationError(message),
      }),
    [],
  );

  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  return useMemo(
    () => ({
      sessionId,
      sendMessage: controller.sendMessage,
      upsertUserShape: controller.upsertUserShape,
      deleteUserShape: controller.deleteUserShape,
      addComment: controller.addComment,
      setPositionOverride: controller.setPositionOverride,
      setSelection: controller.setSelection,
      setViewport: controller.setViewport,
      clearPositionOverrides: controller.clearPositionOverrides,
      cancelRun: controller.cancelRun,
    }),
    [controller, sessionId],
  );
}
