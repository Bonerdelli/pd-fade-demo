export type ToolArgsParseResult =
  | { kind: "streaming"; raw: string }
  | { kind: "parsed"; value: Record<string, unknown> }
  | { kind: "invalid"; raw: string };

export function parseToolArgs(args: unknown, hasResult: boolean): ToolArgsParseResult {
  if (typeof args === "string") {
    return hasResult ? { kind: "invalid", raw: args } : { kind: "streaming", raw: args };
  }

  if (args !== undefined && args !== null && typeof args === "object" && !Array.isArray(args)) {
    return { kind: "parsed", value: args as Record<string, unknown> };
  }

  if (hasResult) {
    const raw = args === undefined || args === null ? "" : JSON.stringify(args);
    return { kind: "invalid", raw };
  }

  return { kind: "streaming", raw: "" };
}

export function formatArgsRaw(args: unknown): string {
  if (typeof args === "string") {
    return args;
  }
  if (args === undefined || args === null) {
    return "";
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}
