import type { AgentEvent } from "@pd-fade/shared";

export interface SseReplaySession {
  unsubscribe: () => void;
}

export function startSseReplaySession(
  afterSeq: number,
  getReplay: () => AgentEvent[],
  subscribe: (listener: (event: AgentEvent) => void) => () => void,
  write: (event: AgentEvent) => void,
): SseReplaySession {
  const pending: AgentEvent[] = [];
  let live = false;
  let lastSentSeq = afterSeq;

  const unsubscribe = subscribe((event) => {
    if (!live) {
      pending.push(event);
      return;
    }
    if (event.seq <= lastSentSeq) {
      return;
    }
    write(event);
    lastSentSeq = event.seq;
  });

  const replay = getReplay();
  for (const event of replay) {
    write(event);
    lastSentSeq = event.seq;
  }

  for (const event of pending) {
    if (event.seq > lastSentSeq) {
      write(event);
      lastSentSeq = event.seq;
    }
  }

  live = true;
  return { unsubscribe };
}
