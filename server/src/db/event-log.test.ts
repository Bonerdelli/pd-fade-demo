import { describe, expect, it } from "vitest";
import { createDatabase } from "./database.js";
import { SessionStore } from "./session-store.js";

describe("event log", () => {
  it("assigns monotonic seq per session", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);

    const first = store.appendEvent("session-1", {
      type: "RUN_STARTED",
      runId: "run-1",
    });
    const second = store.appendEvent("session-1", {
      type: "TEXT_DELTA",
      runId: "run-1",
      messageId: "m1",
      delta: "hello",
    });

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(store.getLastSeq("session-1")).toBe(2);

    db.close();
  });

  it("reads events after cursor", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);

    store.appendEvent("session-1", { type: "RUN_STARTED", runId: "run-1" });
    store.appendEvent("session-1", {
      type: "TEXT_DELTA",
      runId: "run-1",
      messageId: "m1",
      delta: "a",
    });
    store.appendEvent("session-1", {
      type: "TEXT_DELTA",
      runId: "run-1",
      messageId: "m1",
      delta: "b",
    });

    const tail = store.getEventsAfter("session-1", 1);
    expect(tail).toHaveLength(2);
    expect(tail[0]?.type).toBe("TEXT_DELTA");
    expect(tail[1]?.seq).toBe(3);

    db.close();
  });

  it("auto-creates unknown sessions on first touch", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);

    store.ensureSession("new-session");
    const event = store.appendEvent("new-session", { type: "RUN_STARTED", runId: "run-1" });

    expect(event.seq).toBe(1);
    expect(store.getLastSeq("new-session")).toBe(1);

    db.close();
  });
});
