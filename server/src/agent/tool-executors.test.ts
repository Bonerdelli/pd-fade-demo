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

  it("merges repeated search_entities calls by entity id", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    let agentState = store.getAgentState("merge-search-session");

    const first = executeTool("search_entities", { query: "TechBerlin" }, agentState);
    expect(first.status).toBe("ok");
    agentState = first.agentState ?? agentState;
    expect(agentState.graph.nodes).toHaveLength(1);

    const second = executeTool("search_entities", { query: "Spree Ventures" }, agentState);
    expect(second.status).toBe("ok");
    agentState = second.agentState ?? agentState;
    expect(agentState.graph.nodes.map((node) => node.id).sort()).toEqual([
      "company-spree",
      "company-techberlin",
    ]);
    expect(agentState.graph.edges.some((edge) => edge.id === "e1" || edge.id === "e2")).toBe(false);

    const third = executeTool("search_entities", { query: "Anna Schmidt" }, agentState);
    expect(third.status).toBe("ok");
    agentState = third.agentState ?? agentState;
    expect(agentState.graph.nodes).toHaveLength(3);
    expect(agentState.graph.edges.some((edge) => edge.id === "e1")).toBe(true);

    const duplicate = executeTool("search_entities", { query: "TechBerlin" }, agentState);
    expect(duplicate.status).toBe("ok");
    agentState = duplicate.agentState ?? agentState;
    expect(agentState.graph.nodes).toHaveLength(3);

    db.close();
  });

  it("adds repeated plot_signals calls by signal id", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    let agentState = store.getAgentState("merge-plot-session");

    const searchOutcome = executeTool(
      "search_entities",
      { query: "berlin", kinds: ["company"] },
      agentState,
    );
    agentState = searchOutcome.agentState ?? agentState;

    const kreuzberg = executeTool("plot_signals", { keyword: "Kreuzberg" }, agentState);
    expect(kreuzberg.status).toBe("ok");
    agentState = kreuzberg.agentState ?? agentState;
    expect(agentState.map.signals.map((signal) => signal.id)).toEqual(["signal-3"]);

    const brandenburg = executeTool("plot_signals", { keyword: "Brandenburg" }, agentState);
    expect(brandenburg.status).toBe("ok");
    agentState = brandenburg.agentState ?? agentState;
    expect(agentState.map.signals.map((signal) => signal.id).sort()).toEqual([
      "signal-1",
      "signal-3",
    ]);

    const duplicate = executeTool("plot_signals", { keyword: "Kreuzberg" }, agentState);
    expect(duplicate.status).toBe("ok");
    agentState = duplicate.agentState ?? agentState;
    expect(agentState.map.signals).toHaveLength(2);

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
