import { agentStateSchema } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database.js";
import { SessionStore } from "../db/session-store.js";
import { MockAgentDriver } from "./mock-driver.js";

describe("MockAgentDriver", () => {
  it("emits snapshots that validate against agentStateSchema", async () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const driver = new MockAgentDriver();
    const snapshots: unknown[] = [];

    await driver.run(
      {
        sessionId: "mock-session",
        runId: "run-mock",
        userMessage: "show berlin entities",
        userState: store.getUserState("mock-session"),
        agentState: store.getAgentState("mock-session"),
        signal: new AbortController().signal,
      },
      async (event) => {
        const persisted = store.appendEvent("mock-session", event);
        if (persisted.type === "STATE_SNAPSHOT") {
          snapshots.push(persisted.snapshot);
        }
      },
    );

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    for (const snapshot of snapshots) {
      const parsed = agentStateSchema.parse(snapshot);
      expect(parsed.graph.nodes.length).toBeGreaterThanOrEqual(6);
    }

    const searchSnapshot = agentStateSchema.parse(snapshots[0]);
    expect(searchSnapshot.map.shapes).toHaveLength(3);
    expect(searchSnapshot.map.signals).toHaveLength(0);

    const plottedSnapshot = agentStateSchema.parse(snapshots[snapshots.length - 1]);
    expect(plottedSnapshot.map.shapes).toHaveLength(3);
    expect(plottedSnapshot.map.signals).toHaveLength(3);

    db.close();
  });
});
