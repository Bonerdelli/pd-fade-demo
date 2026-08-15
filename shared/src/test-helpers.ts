import { expect } from "vitest";
import type { z } from "zod";

export function expectValid<S extends z.ZodType>(schema: S, value: unknown): void {
  const result = schema.safeParse(value);
  expect(result.success, result.success ? undefined : JSON.stringify(result.error.format())).toBe(
    true,
  );
}

export function expectInvalid<S extends z.ZodType>(schema: S, value: unknown): void {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
}

export const envelope = {
  seq: 1,
  runId: "run-1",
  ts: 1_700_000_000_000,
};

export const emptyAgentState = {
  graph: { nodes: [], edges: [], layout: {} },
  map: { shapes: [], signals: [] },
};
