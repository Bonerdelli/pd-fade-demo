import type { AgentEvent } from "@pd-fade/shared";
import type { ServerResponse } from "node:http";
import type { FastifyRequest } from "fastify";

export const SSE_HEARTBEAT_MS = 15_000;

export function formatSseEvent(event: AgentEvent): string {
  return `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function writeSseEvent(response: ServerResponse, event: AgentEvent): void {
  response.write(formatSseEvent(event));
}

export function writeSseHeartbeat(response: ServerResponse): void {
  response.write(": heartbeat\n\n");
}

export function parseLastEventId(request: FastifyRequest): number {
  const headerValue = request.headers["last-event-id"];
  const queryValue = (request.query as { lastEventId?: string }).lastEventId;

  const raw =
    (Array.isArray(headerValue) ? headerValue[0] : headerValue) ?? queryValue ?? "0";

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
