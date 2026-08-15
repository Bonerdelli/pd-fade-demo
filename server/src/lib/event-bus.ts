import type { AgentEvent } from "@pd-fade/shared";

export type EventListener = (event: AgentEvent) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();

  subscribe(sessionId: string, listener: EventListener): () => void {
    let sessionListeners = this.listeners.get(sessionId);
    if (!sessionListeners) {
      sessionListeners = new Set();
      this.listeners.set(sessionId, sessionListeners);
    }

    sessionListeners.add(listener);

    return () => {
      sessionListeners?.delete(listener);
      if (sessionListeners?.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  publish(sessionId: string, event: AgentEvent): void {
    const sessionListeners = this.listeners.get(sessionId);
    if (!sessionListeners) {
      return;
    }

    for (const listener of sessionListeners) {
      listener(event);
    }
  }
}
