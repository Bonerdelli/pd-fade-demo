import type { AgentEvent } from "@pd-fade/shared";
import { agentEventSchema } from "@pd-fade/shared";

export type SseConnectionStatus = "connected" | "reconnecting" | "down";

export interface ParsedSseEvent {
  id: string | null;
  data: string;
}

export interface SseEventHandler {
  onEvent: (event: AgentEvent) => void;
  onInvalidPayload?: (raw: string, error: unknown) => void;
  onGapDetected?: (lastSeq: number, incomingSeq: number) => void;
  onCursorAhead?: () => void;
  onConnectionStatusChange?: (status: SseConnectionStatus) => void;
  onStreamStalled?: () => void;
}

export interface SseConnectOptions extends SseEventHandler {
  url: string;
  lastEventId?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  stallTimeoutMs?: number;
  scheduleTimeout?: typeof setTimeout;
  clearScheduledTimeout?: typeof clearTimeout;
}

export interface SseDisconnectOptions {
  silent?: boolean;
}

export interface SseConnectionHandle {
  disconnect: (options?: SseDisconnectOptions) => void;
  abortStream: () => void;
}

export const SSE_STALL_TIMEOUT_MS = 45_000;

const MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 500;

export interface SseActivityWatchdog {
  touch: () => void;
  clear: () => void;
}

export function createSseActivityWatchdog(options: {
  timeoutMs: number;
  onStalled: () => void;
  scheduleTimeout?: typeof setTimeout;
  clearScheduledTimeout?: typeof clearTimeout;
}): SseActivityWatchdog {
  const {
    timeoutMs,
    onStalled,
    scheduleTimeout = setTimeout,
    clearScheduledTimeout = clearTimeout,
  } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) {
      clearScheduledTimeout(timer);
      timer = null;
    }
  };

  const touch = () => {
    clear();
    timer = scheduleTimeout(() => {
      timer = null;
      onStalled();
    }, timeoutMs);
  };

  return { touch, clear };
}

export function parseSseChunk(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const remainder = blocks.pop() ?? "";
  const events: ParsedSseEvent[] = [];

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    let id: string | null = null;
    const dataLines: string[] = [];

    for (const line of block.split("\n")) {
      if (line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("id:")) {
        id = line.slice(3).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      events.push({ id, data: dataLines.join("\n") });
    }
  }

  return { events, remainder };
}

export function computeBackoffDelayMs(attempt: number, random = Math.random): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = random() * exponential * 0.25;
  return Math.min(MAX_BACKOFF_MS, exponential + jitter);
}

function shouldAcceptSeq(lastSeq: number, incomingSeq: number): "accept" | "drop" | "gap" {
  if (incomingSeq <= lastSeq) {
    return "drop";
  }
  if (incomingSeq > lastSeq + 1) {
    return "gap";
  }
  return "accept";
}

export async function connectSse(options: SseConnectOptions): Promise<SseConnectionHandle> {
  const {
    url,
    lastEventId: initialLastEventId,
    signal,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    stallTimeoutMs = SSE_STALL_TIMEOUT_MS,
    scheduleTimeout = setTimeout,
    clearScheduledTimeout = clearTimeout,
    onEvent,
    onInvalidPayload,
    onGapDetected,
    onCursorAhead,
    onConnectionStatusChange,
    onStreamStalled,
  } = options;

  let lastSeq = initialLastEventId ?? 0;
  let lastEventIdHeader = initialLastEventId !== undefined ? String(initialLastEventId) : undefined;
  let attempt = 0;
  let closed = false;
  let streamAbortController = new AbortController();
  let currentWatchdog: SseActivityWatchdog | null = null;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const clearActivityWatchdog = () => {
    currentWatchdog?.clear();
    currentWatchdog = null;
  };

  const abortStream = () => {
    clearActivityWatchdog();
    void activeReader?.cancel();
    streamAbortController.abort();
  };

  const disconnect = (options?: SseDisconnectOptions) => {
    closed = true;
    abortStream();
    if (!options?.silent) {
      onConnectionStatusChange?.("down");
    }
  };

  if (signal) {
    signal.addEventListener("abort", () => disconnect(), { once: true });
  }

  void (async () => {
    while (!closed) {
      streamAbortController = new AbortController();
      const streamSignal = streamAbortController.signal;

      if (attempt > 0) {
        onConnectionStatusChange?.("reconnecting");
        await sleep(computeBackoffDelayMs(attempt - 1));
        if (closed || streamSignal.aborted) {
          return;
        }
      }

      try {
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };
        if (lastEventIdHeader !== undefined) {
          headers["Last-Event-ID"] = lastEventIdHeader;
        }

        const response = await fetchImpl(url, {
          headers,
          signal: streamSignal,
        });

        if (!response.ok || !response.body) {
          if (response.status === 409) {
            onCursorAhead?.();
            return;
          }
          throw new Error(`SSE request failed with status ${response.status}`);
        }

        attempt = 0;
        onConnectionStatusChange?.("connected");
        let streamWatchdog: SseActivityWatchdog | null = null;
        clearActivityWatchdog();
        streamWatchdog = createSseActivityWatchdog({
          timeoutMs: stallTimeoutMs,
          scheduleTimeout,
          clearScheduledTimeout,
          onStalled: () => {
            if (closed || streamSignal.aborted) {
              return;
            }
            onStreamStalled?.();
            onConnectionStatusChange?.("reconnecting");
            abortStream();
          },
        });
        currentWatchdog = streamWatchdog;
        streamWatchdog.touch();

        const reader = response.body.getReader();
        activeReader = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed && !streamSignal.aborted) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          streamWatchdog.touch();
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.remainder;

          for (const frame of parsed.events) {
            if (frame.id !== null) {
              lastEventIdHeader = frame.id;
            }

            let payload: unknown;
            try {
              payload = JSON.parse(frame.data);
            } catch (error) {
              console.warn("Dropped invalid SSE JSON payload", error);
              onInvalidPayload?.(frame.data, error);
              continue;
            }

            const validated = agentEventSchema.safeParse(payload);
            if (!validated.success) {
              console.warn("Dropped invalid SSE event payload", validated.error.format());
              onInvalidPayload?.(frame.data, validated.error);
              continue;
            }

            const event = validated.data;
            const seqDecision = shouldAcceptSeq(lastSeq, event.seq);
            if (seqDecision === "drop") {
              continue;
            }
            if (seqDecision === "gap") {
              onGapDetected?.(lastSeq, event.seq);
              reader.cancel().catch(() => undefined);
              abortStream();
              return;
            }

            lastSeq = event.seq;
            if (lastEventIdHeader === undefined) {
              lastEventIdHeader = String(event.seq);
            }
            onEvent(event);
          }
        }

        activeReader = null;
        clearActivityWatchdog();

        if (closed) {
          return;
        }
      } catch {
        clearActivityWatchdog();
        if (closed) {
          return;
        }
      }

      attempt += 1;
    }

    clearActivityWatchdog();

    if (!closed) {
      onConnectionStatusChange?.("down");
    }
  })();

  return { disconnect, abortStream };
}

export function reportInvalidSsePayload(_raw: string, _error: unknown): void {
  // Telemetry hook point for future observability wiring.
}
