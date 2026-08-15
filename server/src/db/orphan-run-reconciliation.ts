import { agentEventSchema, type AgentEvent } from "@pd-fade/shared";
import type Database from "better-sqlite3";
import type { SessionStore } from "./session-store.js";

const TERMINAL_RUN_EVENT_TYPES = new Set<AgentEvent["type"]>([
  "RUN_FINISHED",
  "RUN_ERROR",
  "RUN_CANCELLED",
]);

export const ORPHAN_RUN_ERROR_MESSAGE = "server_restarted";

function listSessionIds(db: Database.Database): string[] {
  const rows = db.prepare(`SELECT id FROM sessions`).all() as { id: string }[];
  return rows.map((row) => row.id);
}

function findOrphanedRunIds(db: Database.Database, sessionId: string): string[] {
  const rows = db
    .prepare(`SELECT payload FROM events WHERE session_id = ? ORDER BY seq ASC`)
    .all(sessionId) as { payload: string }[];

  const startedRunIds = new Set<string>();
  const terminatedRunIds = new Set<string>();

  for (const row of rows) {
    const event = agentEventSchema.parse(JSON.parse(row.payload));
    if (event.type === "RUN_STARTED") {
      startedRunIds.add(event.runId);
    }
    if (TERMINAL_RUN_EVENT_TYPES.has(event.type) && "runId" in event && event.runId) {
      terminatedRunIds.add(event.runId);
    }
  }

  return [...startedRunIds].filter((runId) => !terminatedRunIds.has(runId));
}

export interface ReconcileSessionOptions {
  onEvent?: (event: AgentEvent) => void;
  skipRunIds?: ReadonlySet<string>;
}

export function reconcileSessionOrphanedRuns(
  sessionStore: SessionStore,
  sessionId: string,
  options: ReconcileSessionOptions = {},
): AgentEvent[] {
  const { onEvent, skipRunIds } = options;
  const orphanedRunIds = findOrphanedRunIds(sessionStore.getDatabase(), sessionId).filter(
    (runId) => !skipRunIds?.has(runId),
  );
  const reconciled: AgentEvent[] = [];

  for (const runId of orphanedRunIds) {
    const event = sessionStore.appendEvent(sessionId, {
      type: "RUN_ERROR",
      runId,
      message: ORPHAN_RUN_ERROR_MESSAGE,
    });
    reconciled.push(event);
    onEvent?.(event);
  }

  return reconciled;
}

export function reconcileAllOrphanedRuns(
  sessionStore: SessionStore,
  onEvent?: (sessionId: string, event: AgentEvent) => void,
): AgentEvent[] {
  const reconciled: AgentEvent[] = [];

  for (const sessionId of listSessionIds(sessionStore.getDatabase())) {
    const events = reconcileSessionOrphanedRuns(sessionStore, sessionId, {
      onEvent: (event) => {
        onEvent?.(sessionId, event);
      },
    });
    reconciled.push(...events);
  }

  return reconciled;
}
