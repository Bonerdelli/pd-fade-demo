import type { AppendEventInput, SessionStore } from "../db/session-store.js";
import type { EventBus } from "../lib/event-bus.js";
import type { AgentDriver } from "./driver.js";
import { createAgentDriver } from "./mock-driver.js";
import { isRunCancelledError } from "./driver.js";

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

export class RunManager {
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly eventBus: EventBus,
    private readonly driver: AgentDriver,
  ) {}

  isRunActive(sessionId: string): boolean {
    return this.activeRuns.has(sessionId);
  }

  startRun(sessionId: string, userMessage: string): void {
    if (this.isRunActive(sessionId)) {
      throw new RunConflictError();
    }

    const runId = crypto.randomUUID();
    const abortController = new AbortController();
    this.activeRuns.set(sessionId, { runId, abortController });

    void this.executeRun(sessionId, runId, userMessage, abortController);
  }

  cancelRun(sessionId: string): boolean {
    const activeRun = this.activeRuns.get(sessionId);
    if (!activeRun) {
      return false;
    }

    activeRun.abortController.abort();
    return true;
  }

  private async executeRun(
    sessionId: string,
    runId: string,
    userMessage: string,
    abortController: AbortController,
  ): Promise<void> {
    const emit = async (eventInput: AppendEventInput) => {
      const event = this.sessionStore.appendEvent(sessionId, eventInput);
      this.eventBus.publish(sessionId, event);
    };

    try {
      await this.driver.run(
        {
          sessionId,
          runId,
          userMessage,
          userState: this.sessionStore.getUserState(sessionId),
          agentState: this.sessionStore.getAgentState(sessionId),
          signal: abortController.signal,
        },
        emit,
      );
    } catch (error) {
      if (isRunCancelledError(error) || abortController.signal.aborted) {
        await emit({ type: "RUN_CANCELLED", runId });
      } else {
        const message = error instanceof Error ? error.message : "Unknown run error";
        await emit({ type: "RUN_ERROR", runId, message });
      }
    } finally {
      this.activeRuns.delete(sessionId);
    }
  }
}

export class RunConflictError extends Error {
  constructor() {
    super("A run is already active for this session");
    this.name = "RunConflictError";
  }
}

export function createRunManager(
  sessionStore: SessionStore,
  eventBus: EventBus,
  driverName: string,
): RunManager {
  return new RunManager(sessionStore, eventBus, createAgentDriver(driverName));
}
