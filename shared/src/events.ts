import { z } from "zod";
import { graphCameraSchema, jsonPatchOpSchema, mapCameraSchema } from "./primitives.js";
import { agentStateSchema } from "./state.js";

const eventEnvelopeBaseSchema = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.number(),
});

const runScopedEnvelopeSchema = eventEnvelopeBaseSchema.extend({
  runId: z.string(),
});

const optionalRunEnvelopeSchema = eventEnvelopeBaseSchema.extend({
  runId: z.string().nullable(),
});

export const runStartedEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("RUN_STARTED"),
});

export const runFinishedEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("RUN_FINISHED"),
});

export const runErrorEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("RUN_ERROR"),
  message: z.string(),
});

export const runCancelledEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("RUN_CANCELLED"),
});

export const textDeltaEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("TEXT_DELTA"),
  messageId: z.string(),
  delta: z.string(),
});

export const toolStartEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("TOOL_START"),
  toolCallId: z.string(),
  name: z.string(),
});

export const toolArgsEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("TOOL_ARGS"),
  toolCallId: z.string(),
  delta: z.string(),
});

export const toolResultStatusSchema = z.enum(["ok", "error"]);

export const toolResultEventSchema = runScopedEnvelopeSchema.extend({
  type: z.literal("TOOL_RESULT"),
  toolCallId: z.string(),
  status: toolResultStatusSchema,
  result: z.unknown(),
});

export const stateSnapshotEventSchema = optionalRunEnvelopeSchema.extend({
  type: z.literal("STATE_SNAPSHOT"),
  snapshot: agentStateSchema,
});

export const stateDeltaEventSchema = optionalRunEnvelopeSchema.extend({
  type: z.literal("STATE_DELTA"),
  patch: z.array(jsonPatchOpSchema),
});

export const viewportGraphCommandEventSchema = optionalRunEnvelopeSchema.extend({
  type: z.literal("VIEWPORT_COMMAND"),
  target: z.literal("graph"),
  camera: graphCameraSchema,
});

export const viewportMapCommandEventSchema = optionalRunEnvelopeSchema.extend({
  type: z.literal("VIEWPORT_COMMAND"),
  target: z.literal("map"),
  camera: mapCameraSchema,
});

export const viewportCommandEventSchema = z.discriminatedUnion("target", [
  viewportGraphCommandEventSchema,
  viewportMapCommandEventSchema,
]);

export const agentEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  runFinishedEventSchema,
  runErrorEventSchema,
  runCancelledEventSchema,
  textDeltaEventSchema,
  toolStartEventSchema,
  toolArgsEventSchema,
  toolResultEventSchema,
  stateSnapshotEventSchema,
  stateDeltaEventSchema,
  viewportCommandEventSchema,
]);

export type AgentEvent = z.infer<typeof agentEventSchema>;
export type ToolResultStatus = z.infer<typeof toolResultStatusSchema>;
export type ViewportTarget = "graph" | "map";

export const agentEventTypeSchema = z.enum([
  "RUN_STARTED",
  "RUN_FINISHED",
  "RUN_ERROR",
  "RUN_CANCELLED",
  "TEXT_DELTA",
  "TOOL_START",
  "TOOL_ARGS",
  "TOOL_RESULT",
  "STATE_SNAPSHOT",
  "STATE_DELTA",
  "VIEWPORT_COMMAND",
]);

export type AgentEventType = z.infer<typeof agentEventTypeSchema>;
