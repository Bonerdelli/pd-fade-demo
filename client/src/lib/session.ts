import {
  sessionEventsPath,
  sessionStatePath,
  sessionStateResponseSchema,
  type SessionStateResponse,
} from "@pd-fade/shared";
import { apiUrl } from "./api-base.js";
import { connectSse, reportInvalidSsePayload, type SseConnectionHandle, type SseConnectionStatus } from "./sse.js";

export function readSessionIdFromUrl(location: Location = window.location): string | null {
  const params = new URLSearchParams(location.search);
  return params.get("session");
}

export function writeSessionIdToUrl(sessionId: string, location: Location = window.location): void {
  const url = new URL(location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url);
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export interface SessionControllerOptions {
  getSessionId: () => string | null;
  setSessionId: (sessionId: string) => void;
  setBootstrapStatus: (status: "loading" | "ready" | "error") => void;
  setConnectionStatus: (status: SseConnectionStatus) => void;
  hydrateSession: (response: SessionStateResponse) => void;
  applyEvent: (event: SessionStateResponse["tailEvents"][number]) => void;
  getLastSeq: () => number;
  fetchImpl?: typeof fetch;
}

export interface SessionController {
  start: () => Promise<void>;
  stop: () => void;
  resync: () => Promise<void>;
}

export async function fetchSessionState(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SessionStateResponse> {
  const response = await fetchImpl(apiUrl(sessionStatePath(sessionId)));
  if (!response.ok) {
    throw new Error(`Failed to load session state (${response.status})`);
  }

  const json: unknown = await response.json();
  const parsed = sessionStateResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Session state response failed validation");
  }

  return parsed.data;
}

export function createSessionController(options: SessionControllerOptions): SessionController {
  const {
    getSessionId,
    setSessionId,
    setBootstrapStatus,
    setConnectionStatus,
    hydrateSession,
    applyEvent,
    getLastSeq,
    fetchImpl = fetch,
  } = options;

  let sseConnection: SseConnectionHandle | null = null;
  let stopped = false;
  let resyncInFlight: Promise<void> | null = null;
  let lifecycleToken = 0;

  const isLifecycleActive = (token: number): boolean => !stopped && token === lifecycleToken;

  const stop = () => {
    stopped = true;
    lifecycleToken += 1;
    sseConnection?.disconnect();
    sseConnection = null;
    setConnectionStatus("down");
  };

  const connectStream = async (sessionId: string, token: number) => {
    if (!isLifecycleActive(token)) {
      return;
    }

    sseConnection?.disconnect();
    sseConnection = null;

    if (!isLifecycleActive(token)) {
      return;
    }

    sseConnection = await connectSse({
      url: apiUrl(sessionEventsPath(sessionId)),
      lastEventId: getLastSeq(),
      onEvent: applyEvent,
      onInvalidPayload: reportInvalidSsePayload,
      onConnectionStatusChange: setConnectionStatus,
      onGapDetected: () => {
        setConnectionStatus("reconnecting");
        void resync();
      },
      onCursorAhead: () => {
        setConnectionStatus("reconnecting");
        void resync();
      },
      onStreamStalled: () => {
        setConnectionStatus("reconnecting");
        sseConnection?.abortStream();
      },
      fetchImpl,
    });
  };

  const resync = async () => {
    if (resyncInFlight) {
      return resyncInFlight;
    }

    const token = lifecycleToken;

    resyncInFlight = (async () => {
      const sessionId = getSessionId();
      if (!isLifecycleActive(token) || !sessionId) {
        return;
      }

      sseConnection?.disconnect();
      sseConnection = null;
      setConnectionStatus("reconnecting");
      setBootstrapStatus("loading");

      try {
        const state = await fetchSessionState(sessionId, fetchImpl);
        if (!isLifecycleActive(token)) {
          return;
        }

        hydrateSession(state);
        setBootstrapStatus("ready");
        await connectStream(sessionId, token);
      } catch {
        if (!isLifecycleActive(token)) {
          return;
        }
        setBootstrapStatus("error");
        setConnectionStatus("down");
      } finally {
        resyncInFlight = null;
      }
    })();

    return resyncInFlight;
  };

  const start = async () => {
    stopped = false;
    lifecycleToken += 1;
    const token = lifecycleToken;

    setBootstrapStatus("loading");

    let sessionId = getSessionId();
    if (!sessionId) {
      sessionId = createSessionId();
      writeSessionIdToUrl(sessionId);
      setSessionId(sessionId);
    }

    try {
      const state = await fetchSessionState(sessionId, fetchImpl);
      if (!isLifecycleActive(token)) {
        return;
      }

      hydrateSession(state);
      setBootstrapStatus("ready");
      await connectStream(sessionId, token);
    } catch {
      if (!isLifecycleActive(token)) {
        return;
      }
      setBootstrapStatus("error");
      setConnectionStatus("down");
    }
  };

  return { start, stop, resync };
}
