import type { AgentState, UserState } from "@pd-fade/shared";
import type { AppendEventInput } from "../db/session-store.js";

export type EmitFn = (event: AppendEventInput) => Promise<void>;

export interface AgentRunContext {
  sessionId: string;
  runId: string;
  userMessage: string;
  userState: UserState;
  agentState: AgentState;
  signal: AbortSignal;
}

export interface AgentDriver {
  run(context: AgentRunContext, emit: EmitFn): Promise<void>;
}

export class RunCancelledError extends Error {
  constructor() {
    super("Run cancelled");
    this.name = "RunCancelledError";
  }
}

export function isRunCancelledError(error: unknown): boolean {
  return error instanceof RunCancelledError;
}

export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new RunCancelledError();
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new RunCancelledError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function emitTextDeltas(
  emit: EmitFn,
  runId: string,
  messageId: string,
  text: string,
  signal: AbortSignal,
): Promise<void> {
  const words = text.split(/(\s+)/);

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }
    await delay(25, signal);
    await emit({
      type: "TEXT_DELTA",
      runId,
      messageId,
      delta: word,
    });
  }
}

export async function emitToolCall(
  emit: EmitFn,
  runId: string,
  toolCallId: string,
  name: string,
  args: unknown,
  result: unknown,
  signal: AbortSignal,
): Promise<void> {
  await emit({
    type: "TOOL_START",
    runId,
    toolCallId,
    name,
  });

  const argsJson = JSON.stringify(args);
  const chunkSize = Math.max(1, Math.ceil(argsJson.length / 3));
  for (let index = 0; index < argsJson.length; index += chunkSize) {
    await delay(30, signal);
    await emit({
      type: "TOOL_ARGS",
      runId,
      toolCallId,
      delta: argsJson.slice(index, index + chunkSize),
    });
  }

  await delay(40, signal);
  await emit({
    type: "TOOL_RESULT",
    runId,
    toolCallId,
    status: "ok",
    result,
  });
}
