import {
  sessionEventsPath,
  sessionMessagesPath,
  sessionStatePath,
} from "@pd-fade/shared";
import { get } from "node:http";
import { describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { formatSseEvent } from "./sse.js";
import { waitForRunToFinish } from "../test-helpers.js";
import type { AgentEvent } from "@pd-fade/shared";

describe("SSE", () => {
  it("formats events with id and data fields", () => {
    const event = {
      seq: 42,
      runId: "run-1",
      ts: 1,
      type: "RUN_STARTED",
    } satisfies AgentEvent;

    expect(formatSseEvent(event)).toBe(
      'id: 42\ndata: {"seq":42,"runId":"run-1","ts":1,"type":"RUN_STARTED"}\n\n',
    );
  });

  it("replays tail after Last-Event-ID over live connection", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    await app.listen({ port: 0, host: "127.0.0.1" });

    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected server address");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const sessionId = "sse-session";
    const eventsUrl = `${baseUrl}${sessionEventsPath(sessionId)}`;

    const collected = await new Promise<string>((resolve, reject) => {
      const request = get(eventsUrl, (response) => {
        let body = "";
        response.on("data", (chunk: Buffer) => {
          body += chunk.toString();
          if (body.includes("RUN_FINISHED")) {
            response.destroy();
            request.destroy();
            resolve(body);
          }
        });
        response.on("error", (error: NodeJS.ErrnoException) => {
          if (error.code === "ECONNRESET") {
            resolve(body);
            return;
          }
          reject(error);
        });
      });

      request.on("error", reject);

      setTimeout(() => {
        void fetch(`${baseUrl}${sessionMessagesPath(sessionId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "hello sse" }),
        });
      }, 50);

      setTimeout(() => reject(new Error("SSE stream timeout")), 12_000);
    });

    expect(collected).toContain('"type":"RUN_STARTED"');
    const lastIdMatch = [...collected.matchAll(/^id: (\d+)$/gm)].at(-1);
    expect(lastIdMatch).toBeDefined();

    const lastEventId = Number(lastIdMatch?.[1]);
    expect(lastEventId).toBeGreaterThan(0);

    const replayBody = await new Promise<string>((resolve, reject) => {
      const request = get(
        `${baseUrl}${sessionEventsPath(sessionId)}?lastEventId=${lastEventId}`,
        {
          headers: { "Last-Event-ID": String(lastEventId) },
        },
        (response) => {
          let body = "";
          response.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          response.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "ECONNRESET") {
              resolve(body);
              return;
            }
            reject(error);
          });
          setTimeout(() => {
            response.destroy();
            request.destroy();
            resolve(body);
          }, 200);
        },
      );
      request.on("error", reject);
    });

    expect(replayBody).not.toContain('"type":"RUN_STARTED"');
    expect(replayBody.includes(`"seq":${lastEventId}`)).toBe(false);

    await app.close();
  }, 20_000);

  it("returns 409 when Last-Event-ID is ahead of the persisted log", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "cursor-ahead-session";

    const response = await app.inject({
      method: "GET",
      url: `${sessionEventsPath(sessionId)}?lastEventId=100`,
      headers: { "Last-Event-ID": "100" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "cursor_ahead" });

    await app.close();
  });

  it("replays events when Last-Event-ID is older than the latest snapshot anchor", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    await app.listen({ port: 0, host: "127.0.0.1" });

    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected server address");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const sessionId = "snapshot-replay-session";

    await fetch(`${baseUrl}${sessionMessagesPath(sessionId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "show berlin entities" }),
    });
    await waitForRunToFinish(app, sessionId);

    const stateBody = (
      await app.inject({
        method: "GET",
        url: sessionStatePath(sessionId),
      })
    ).json() as {
      tailEvents: Array<{ seq: number; type: string }>;
      lastSeq: number;
    };

    const snapshotEvent = stateBody.tailEvents.find((event) => event.type === "STATE_SNAPSHOT");
    expect(snapshotEvent).toBeDefined();

    const oldCursor = Math.max(0, snapshotEvent!.seq - 3);
    const replayBody = await new Promise<string>((resolve, reject) => {
      const request = get(
        `${baseUrl}${sessionEventsPath(sessionId)}?lastEventId=${oldCursor}`,
        {
          headers: { "Last-Event-ID": String(oldCursor) },
        },
        (response) => {
          let body = "";
          response.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          response.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "ECONNRESET") {
              resolve(body);
              return;
            }
            reject(error);
          });
          setTimeout(() => {
            response.destroy();
            request.destroy();
            resolve(body);
          }, 300);
        },
      );
      request.on("error", reject);
    });

    expect(replayBody).toContain('"type":"STATE_SNAPSHOT"');
    expect(replayBody).toContain(`"seq":${stateBody.lastSeq}`);

    await app.close();
  }, 20_000);
});

describe("session state endpoint", () => {
  it("returns snapshot, chat and tail events", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "state-session";

    const messageResponse = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "build graph" },
    });
    expect(messageResponse.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });

    expect(stateResponse.statusCode).toBe(200);
    const body = stateResponse.json();
    expect(body.chat.some((message: { kind: string }) => message.kind === "user")).toBe(true);
    expect(body.snapshot.graph.nodes.length).toBeGreaterThan(0);
    expect(body.lastSeq).toBeGreaterThan(0);

    await app.close();
  }, 20_000);
});
