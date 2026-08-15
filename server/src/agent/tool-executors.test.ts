import { agentStateSchema } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database.js";
import { SessionStore } from "../db/session-store.js";
import { BERLIN_CENTER } from "./dataset.js";
import { executeTool } from "./tool-executors.js";

describe("tool executors", () => {
  it("builds cumulative agent state that validates against agentStateSchema", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    let agentState = store.getAgentState("executor-session");

    const searchOutcome = executeTool(
      "search_entities",
      {
        query: "berlin",
        kinds: ["company", "person", "location"],
        city: "Berlin",
      },
      agentState,
    );

    expect(searchOutcome.status).toBe("ok");
    agentState = searchOutcome.agentState ?? agentState;
    agentStateSchema.parse(agentState);

    const plotOutcome = executeTool(
      "plot_signals",
      { signalIds: ["signal-1", "signal-2", "signal-3"], center: BERLIN_CENTER },
      agentState,
    );

    expect(plotOutcome.status).toBe("ok");
    agentState = plotOutcome.agentState ?? agentState;
    const parsed = agentStateSchema.parse(agentState);

    expect(parsed.graph.nodes.length).toBeGreaterThanOrEqual(8);
    expect(parsed.map.signals).toHaveLength(3);
    expect(parsed.map.shapes).toHaveLength(3);

    db.close();
  });

  it("returns viewport intent for focus without mutating agent state", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const agentState = store.getAgentState("focus-session");

    const outcome = executeTool("focus", { target: "map" }, agentState);

    expect(outcome.status).toBe("ok");
    expect(outcome.agentState).toBeUndefined();
    expect(outcome.viewportCommand).toEqual({
      target: "map",
      camera: { center: BERLIN_CENTER, zoom: 12.5 },
    });

    db.close();
  });
});
