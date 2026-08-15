import { useEffect, useRef } from "react";
import {
  createSessionController,
  createSessionId,
  readSessionIdFromUrl,
  writeSessionIdToUrl,
} from "../lib/session.js";
import { useAppStore } from "../store/index.js";

export function useSessionBootstrap(): void {
  const controllerRef = useRef<ReturnType<typeof createSessionController> | null>(null);

  useEffect(() => {
    const controller = createSessionController({
      getSessionId: () => useAppStore.getState().sessionId ?? readSessionIdFromUrl(),
      setSessionId: (sessionId) => {
        writeSessionIdToUrl(sessionId);
        useAppStore.getState().setSessionId(sessionId);
      },
      setBootstrapStatus: (status) => useAppStore.getState().setBootstrapStatus(status),
      setConnectionStatus: (status) => useAppStore.getState().setConnectionStatus(status),
      hydrateSession: (response) => useAppStore.getState().hydrateSession(response),
      applyEvent: (event) => useAppStore.getState().applyEvent(event),
      getLastSeq: () => useAppStore.getState().uiState.lastSeq,
    });

    controllerRef.current = controller;

    const existingSessionId = readSessionIdFromUrl();
    if (existingSessionId) {
      useAppStore.getState().setSessionId(existingSessionId);
    } else {
      const sessionId = createSessionId();
      writeSessionIdToUrl(sessionId);
      useAppStore.getState().setSessionId(sessionId);
    }

    void controller.start();
    useAppStore.getState().setRetrySessionBootstrap(() => {
      void controller.start();
    });

    return () => {
      controller.stop();
      useAppStore.getState().setRetrySessionBootstrap(null);
      controllerRef.current = null;
    };
  }, []);
}
