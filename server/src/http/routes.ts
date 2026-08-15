import {
  cancelRunResponseSchema,
  postCanvasRequestSchema,
  postCanvasResponseSchema,
  postMessageRequestSchema,
  postMessageResponseSchema,
  sessionRouteParamsSchema,
  sessionStateResponseSchema,
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionEventsPath,
  sessionMessagesPath,
  sessionStatePath,
} from "@pd-fade/shared";
import type { FastifyInstance } from "fastify";
import type { RunManager } from "../agent/run-manager.js";
import { RunConflictError } from "../agent/run-manager.js";
import { reconcileSessionOrphanedRuns } from "../db/orphan-run-reconciliation.js";
import type { SessionStore } from "../db/session-store.js";
import { emptyAgentState } from "../db/empty-states.js";
import type { EventBus } from "../lib/event-bus.js";
import {
  SSE_HEARTBEAT_MS,
  parseLastEventId,
  sseHeaders,
  writeSseEvent,
  writeSseHeartbeat,
} from "./sse.js";
import { startSseReplaySession } from "./sse-replay.js";

export interface HttpDependencies {
  sessionStore: SessionStore;
  eventBus: EventBus;
  runManager: RunManager;
}

function touchSession(
  sessionStore: SessionStore,
  eventBus: EventBus,
  sessionId: string,
): void {
  sessionStore.ensureSession(sessionId);
  reconcileSessionOrphanedRuns(sessionStore, sessionId, (event) => {
    eventBus.publish(sessionId, event);
  });
}

export function registerSessionRoutes(app: FastifyInstance, deps: HttpDependencies): void {
  const { sessionStore, eventBus, runManager } = deps;

  app.get(sessionEventsPath(":id"), async (request, reply) => {
    const { id } = sessionRouteParamsSchema.parse(request.params);
    touchSession(sessionStore, eventBus, id);

    const afterSeq = parseLastEventId(request);
    const lastSeq = sessionStore.getLastSeq(id);

    if (afterSeq > lastSeq) {
      return reply.status(409).send({ error: "cursor_ahead" });
    }

    reply.hijack();
    reply.raw.writeHead(200, sseHeaders());

    const { unsubscribe } = startSseReplaySession(
      afterSeq,
      () => sessionStore.getEventsAfter(id, afterSeq),
      (listener) => eventBus.subscribe(id, listener),
      (event) => writeSseEvent(reply.raw, event),
    );

    const heartbeat = setInterval(() => {
      writeSseHeartbeat(reply.raw);
    }, SSE_HEARTBEAT_MS);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get(sessionStatePath(":id"), async (request) => {
    const { id } = sessionRouteParamsSchema.parse(request.params);
    touchSession(sessionStore, eventBus, id);

    const latestSnapshot = sessionStore.getLatestSnapshot(id);
    const snapshotSeq = latestSnapshot?.seq ?? 0;

    const response = sessionStateResponseSchema.parse({
      snapshot: latestSnapshot?.snapshot ?? emptyAgentState,
      userState: sessionStore.getUserState(id),
      chat: sessionStore.getChat(id),
      tailEvents: sessionStore.getEventsAfter(id, snapshotSeq),
      lastSeq: sessionStore.getLastSeq(id),
    });

    return response;
  });

  app.post(sessionMessagesPath(":id"), async (request, reply) => {
    const { id } = sessionRouteParamsSchema.parse(request.params);
    const body = postMessageRequestSchema.parse(request.body);

    touchSession(sessionStore, eventBus, id);

    if (runManager.isRunActive(id)) {
      return reply.status(409).send({ error: "run_active" });
    }
    const messageId = body.messageId ?? crypto.randomUUID();
    sessionStore.addUserMessage(id, messageId, body.text);

    try {
      runManager.startRun(id, body.text);
    } catch (error) {
      if (error instanceof RunConflictError) {
        return reply.status(409).send({ error: "run_active" });
      }
      throw error;
    }

    return postMessageResponseSchema.parse({ accepted: true });
  });

  app.post(sessionCanvasPath(":id"), async (request, reply) => {
    const { id } = sessionRouteParamsSchema.parse(request.params);
    const body = postCanvasRequestSchema.parse(request.body);

    if (runManager.isRunActive(id) && !sessionStore.isRunAllowedCanvasMutation(body.mutation)) {
      return reply.status(409).send({ error: "run_active" });
    }

    touchSession(sessionStore, eventBus, id);
    sessionStore.applyCanvasMutation(id, body.mutation);
    return postCanvasResponseSchema.parse({ accepted: true });
  });

  app.post(sessionCancelRunPath(":id"), async (request, reply) => {
    const { id } = sessionRouteParamsSchema.parse(request.params);
    touchSession(sessionStore, eventBus, id);
    const cancelled = runManager.cancelRun(id);

    if (!cancelled) {
      return reply.status(204).send();
    }

    return cancelRunResponseSchema.parse({ accepted: true });
  });
}
