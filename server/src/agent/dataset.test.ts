import { describe, expect, it } from "vitest";
import { ENTITIES, searchEntities, selectSignals } from "./dataset.js";

describe("dataset", () => {
  it("searches entities deterministically by kind filter", () => {
    const result = searchEntities({
      query: "show berlin",
      kinds: ["company", "person", "location"],
      city: "Berlin",
    });

    expect(result.matchCount).toBe(ENTITIES.length);
    expect(result.nodes).toHaveLength(ENTITIES.length);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(Object.keys(result.layout).length).toBe(ENTITIES.length);
  });

  it("selects signals by id", () => {
    const signals = selectSignals({ signalIds: ["signal-1", "signal-3"] });
    expect(signals).toHaveLength(2);
    expect(signals.map((signal) => signal.id)).toEqual(["signal-1", "signal-3"]);
  });
});
