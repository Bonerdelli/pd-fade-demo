import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./database.js";
import {
  ORPHAN_RUN_ERROR_MESSAGE,
  reconcileAllOrphanedRuns,
  reconcileSessionOrphanedRuns,
} from "./orphan-run-reconciliation.js";
import { SessionStore } from "./session-store.js";

describe("orphan run reconciliation", () => {
  it("appends RUN_ERROR and finalizes in-flight tool cards", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const sessionId = "orphan-session";

    store.ensureSession(sessionId);
    store.appendEvent(sessionId, { type: "RUN_STARTED", runId: "run-orphan" });
    store.appendEvent(sessionId, {
      type: "TOOL_START",
      runId: "run-orphan",
      toolCallId: "tool-orphan",
      name: "searchEntities",
    });

    const reconciled = reconcileSessionOrphanedRuns(store, sessionId);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toMatchObject({
      type: "RUN_ERROR",
      runId: "run-orphan",
      message: ORPHAN_RUN_ERROR_MESSAGE,
    });

    const toolCard = store
      .getChat(sessionId)
      .find((message) => message.kind === "toolCall" && message.toolCallId === "tool-orphan");
    expect(toolCard).toMatchObject({ kind: "toolCall", status: "error" });

    db.close();
  });

  it("reconciles persisted orphaned runs when reopening the database", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pd-fade-orphan-"));
    const dbPath = join(tempDir, "session.db");

    try {
      const seedDb = createDatabase(dbPath);
      const seedStore = new SessionStore(seedDb);
      const sessionId = "orphan-startup-session";

      seedStore.ensureSession(sessionId);
      seedStore.appendEvent(sessionId, { type: "RUN_STARTED", runId: "run-orphan" });
      seedStore.appendEvent(sessionId, {
        type: "TOOL_START",
        runId: "run-orphan",
        toolCallId: "tool-orphan",
        name: "searchEntities",
      });
      seedDb.close();

      const reopenedDb = createDatabase(dbPath);
      const reopenedStore = new SessionStore(reopenedDb);
      const reconciled = reconcileAllOrphanedRuns(reopenedStore);

      expect(reconciled).toHaveLength(1);
      expect(reconciled[0]).toMatchObject({
        type: "RUN_ERROR",
        message: ORPHAN_RUN_ERROR_MESSAGE,
      });

      reopenedStore.appendEvent(sessionId, { type: "RUN_STARTED", runId: "run-next" });
      reopenedStore.appendEvent(sessionId, { type: "RUN_FINISHED", runId: "run-next" });
      expect(reconcileSessionOrphanedRuns(reopenedStore, sessionId)).toHaveLength(0);

      reopenedDb.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips reconciliation for run ids that are still executing in memory", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const sessionId = "active-run-session";

    store.ensureSession(sessionId);
    store.appendEvent(sessionId, { type: "RUN_STARTED", runId: "run-active" });
    store.appendEvent(sessionId, {
      type: "TOOL_START",
      runId: "run-active",
      toolCallId: "tool-active",
      name: "searchEntities",
    });

    const reconciled = reconcileSessionOrphanedRuns(store, sessionId, {
      skipRunIds: new Set(["run-active"]),
    });

    expect(reconciled).toHaveLength(0);
    expect(store.getLastSeq(sessionId)).toBe(2);

    db.close();
  });

  it("reconciles multiple orphaned runs across sessions on startup", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pd-fade-orphan-multi-"));
    const dbPath = join(tempDir, "session.db");

    try {
      const seedDb = createDatabase(dbPath);
      const seedStore = new SessionStore(seedDb);

      for (const [sessionId, runId] of [
        ["orphan-session-a", "run-a"],
        ["orphan-session-b", "run-b"],
      ] as const) {
        seedStore.ensureSession(sessionId);
        seedStore.appendEvent(sessionId, { type: "RUN_STARTED", runId });
        seedStore.appendEvent(sessionId, {
          type: "TOOL_START",
          runId,
          toolCallId: `${runId}-tool`,
          name: "searchEntities",
        });
      }
      seedDb.close();

      const reopenedDb = createDatabase(dbPath);
      const reopenedStore = new SessionStore(reopenedDb);
      const reconciled = reconcileAllOrphanedRuns(reopenedStore);

      expect(reconciled).toHaveLength(2);
      expect(new Set(reconciled.map((event) => event.runId))).toEqual(new Set(["run-a", "run-b"]));
      expect(reconciled.every((event) => event.message === ORPHAN_RUN_ERROR_MESSAGE)).toBe(true);

      reopenedDb.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not reconcile runs that already have a terminal event", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const sessionId = "completed-session";

    store.ensureSession(sessionId);
    store.appendEvent(sessionId, { type: "RUN_STARTED", runId: "run-1" });
    store.appendEvent(sessionId, { type: "RUN_FINISHED", runId: "run-1" });

    const reconciled = reconcileAllOrphanedRuns(store);
    expect(reconciled).toHaveLength(0);
    expect(store.getLastSeq(sessionId)).toBe(2);

    db.close();
  });
});
