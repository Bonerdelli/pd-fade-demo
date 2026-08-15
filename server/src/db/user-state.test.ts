import { describe, expect, it } from "vitest";
import { createDatabase } from "./database.js";
import { SessionStore } from "./session-store.js";

describe("applyCanvasMutation", () => {
  it("clears all position overrides", () => {
    const db = createDatabase(":memory:");
    const store = new SessionStore(db);
    const sessionId = "session-1";

    store.ensureSession(sessionId);
    store.applyCanvasMutation(sessionId, {
      type: "setPositionOverride",
      nodeId: "n1",
      position: { x: 10, y: 20 },
    });
    store.applyCanvasMutation(sessionId, {
      type: "setPositionOverride",
      nodeId: "n2",
      position: { x: 30, y: 40 },
    });

    const cleared = store.applyCanvasMutation(sessionId, {
      type: "clearPositionOverrides",
    });

    expect(cleared.positionOverrides).toEqual({});
    db.close();
  });
});
