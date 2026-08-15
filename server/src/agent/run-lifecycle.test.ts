import {
  agentStateSchema,
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionMessagesPath,
} from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { wait, waitForRunToFinish } from "../test-helpers.js";

describe("run lifecycle", () => {
  it("runs message flow and stores ordered events", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "run-session";

    const response = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "explore berlin" },
    });
    expect(response.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: `/session/${sessionId}/state`,
    });
    const state = stateResponse.json();

    const types = state.tailEvents.map((event: { type: string }) => event.type);
    expect(types).toContain("RUN_FINISHED");
    expect(types).not.toContain("STATE_SNAPSHOT");
    expect(agentStateSchema.parse(state.snapshot).graph.nodes.length).toBeGreaterThanOrEqual(6);

    await app.close();
  }, 20_000);

  it("returns 409 for concurrent messages", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "conflict-session";

    const first = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "first" },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "second" },
    });
    expect(second.statusCode).toBe(409);

    await waitForRunToFinish(app, sessionId);
    await app.close();
  }, 20_000);

  it("cancels an active run with RUN_CANCELLED", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "cancel-session";

    await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "long run" },
    });

    await wait(80);

    const cancel = await app.inject({
      method: "POST",
      url: sessionCancelRunPath(sessionId),
    });
    expect(cancel.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: `/session/${sessionId}/state`,
    });
    const state = stateResponse.json();
    const types = state.tailEvents.map((event: { type: string }) => event.type);

    expect(types).toContain("RUN_CANCELLED");
    expect(types).not.toContain("RUN_FINISHED");

    await app.close();
  }, 20_000);
});

describe("canvas mutations", () => {
  it("applies user_state mutations", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "canvas-session";

    const response = await app.inject({
      method: "POST",
      url: sessionCanvasPath(sessionId),
      payload: {
        mutation: {
          type: "upsertUserShape",
          shape: { id: "user-shape-1", kind: "point", coordinates: [13.4, 52.5] },
        },
      },
    });
    expect(response.statusCode).toBe(200);

    const stateResponse = await app.inject({
      method: "GET",
      url: `/session/${sessionId}/state`,
    });
    const state = stateResponse.json();
    expect(state.userState.map.shapes).toHaveLength(1);

    await app.close();
  });

  it("rejects shape mutations during run but allows selection", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "canvas-run-session";

    await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "start run" },
    });

    const blocked = await app.inject({
      method: "POST",
      url: sessionCanvasPath(sessionId),
      payload: {
        mutation: {
          type: "upsertUserShape",
          shape: { id: "blocked", kind: "point", coordinates: [1, 2] },
        },
      },
    });
    expect(blocked.statusCode).toBe(409);

    const allowed = await app.inject({
      method: "POST",
      url: sessionCanvasPath(sessionId),
      payload: {
        mutation: {
          type: "setSelection",
          nodeIds: ["node-1"],
        },
      },
    });
    expect(allowed.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);
    await app.close();
  }, 20_000);
});
