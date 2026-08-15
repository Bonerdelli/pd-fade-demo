import type { FastifyInstance } from "fastify";

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForRunToFinish(
  app: FastifyInstance,
  sessionId: string,
  timeoutMs = 8_000,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const response = await app.inject({
      method: "GET",
      url: `/session/${sessionId}/state`,
    });
    const body = response.json() as {
      tailEvents: Array<{ type: string }>;
      lastSeq: number;
    };

    if (body.tailEvents.some((event) => event.type === "RUN_FINISHED")) {
      return;
    }

    if (body.tailEvents.some((event) => event.type === "RUN_CANCELLED")) {
      return;
    }

    await wait(200);
  }

  throw new Error(`Run did not finish within ${timeoutMs}ms`);
}

export async function waitForRunningToolCall(
  app: FastifyInstance,
  sessionId: string,
  timeoutMs = 8_000,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const response = await app.inject({
      method: "GET",
      url: `/session/${sessionId}/state`,
    });
    const body = response.json() as {
      chat: Array<{ kind: string; status?: string }>;
    };

    const hasRunningTool = body.chat.some(
      (message) =>
        message.kind === "toolCall" &&
        (message.status === "running" || message.status === "pending"),
    );

    if (hasRunningTool) {
      return;
    }

    await wait(25);
  }

  throw new Error(`No running tool call within ${timeoutMs}ms`);
}
