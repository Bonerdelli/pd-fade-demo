import { z } from "zod";
import { graphCameraSchema, mapCameraSchema } from "./primitives.js";
import { chatMessageSchema } from "./chat.js";
import { agentEventSchema } from "./events.js";
import { agentStateSchema, mapShapeSchema, userStateSchema } from "./state.js";

export const postMessageRequestSchema = z.object({
  text: z.string().min(1),
  messageId: z.string().optional(),
});

export const postMessageResponseSchema = z.object({
  accepted: z.literal(true),
});

export const upsertUserShapeMutationSchema = z.object({
  type: z.literal("upsertUserShape"),
  shape: mapShapeSchema,
});

export const deleteUserShapeMutationSchema = z.object({
  type: z.literal("deleteUserShape"),
  shapeId: z.string(),
});

export const addCommentMutationSchema = z.object({
  type: z.literal("addComment"),
  comment: z.object({
    id: z.string(),
    targetShapeId: z.string(),
    text: z.string(),
  }),
});

export const setPositionOverrideMutationSchema = z.object({
  type: z.literal("setPositionOverride"),
  nodeId: z.string(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable(),
});

export const setSelectionMutationSchema = z.object({
  type: z.literal("setSelection"),
  nodeIds: z.array(z.string()),
});

export const setGraphViewportMutationSchema = z.object({
  type: z.literal("setViewport"),
  target: z.literal("graph"),
  camera: graphCameraSchema.nullable(),
});

export const setMapViewportMutationSchema = z.object({
  type: z.literal("setViewport"),
  target: z.literal("map"),
  camera: mapCameraSchema.nullable(),
});

export const setViewportMutationSchema = z.discriminatedUnion("target", [
  setGraphViewportMutationSchema,
  setMapViewportMutationSchema,
]);

export const canvasMutationSchema = z.discriminatedUnion("type", [
  upsertUserShapeMutationSchema,
  deleteUserShapeMutationSchema,
  addCommentMutationSchema,
  setPositionOverrideMutationSchema,
  setSelectionMutationSchema,
  setViewportMutationSchema,
]);

export const postCanvasRequestSchema = z.object({
  mutation: canvasMutationSchema,
});

export const postCanvasResponseSchema = z.object({
  accepted: z.literal(true),
});

/**
 * Session bootstrap payload returned by GET /session/:id/state.
 *
 * Contract: `chat` is the server-authoritative, fully materialized read model up to
 * `lastSeq`. Clients must apply `tailEvents` only for non-chat projections
 * (agentState, run status, camera commands) and then set `chat` from this field —
 * never re-project chat by folding TEXT_DELTA / TOOL_* events from `tailEvents`.
 */
export const sessionStateResponseSchema = z.object({
  snapshot: agentStateSchema,
  userState: userStateSchema,
  chat: z.array(chatMessageSchema),
  tailEvents: z.array(agentEventSchema),
  lastSeq: z.number().int().nonnegative(),
});

export const cancelRunResponseSchema = z.object({
  accepted: z.literal(true),
});

export type PostMessageRequest = z.infer<typeof postMessageRequestSchema>;
export type PostMessageResponse = z.infer<typeof postMessageResponseSchema>;
export type CanvasMutation = z.infer<typeof canvasMutationSchema>;
export type PostCanvasRequest = z.infer<typeof postCanvasRequestSchema>;
export type PostCanvasResponse = z.infer<typeof postCanvasResponseSchema>;
export type SessionStateResponse = z.infer<typeof sessionStateResponseSchema>;
export type CancelRunResponse = z.infer<typeof cancelRunResponseSchema>;

export const sessionRouteParamsSchema = z.object({
  id: z.string().min(1),
});

export type SessionRouteParams = z.infer<typeof sessionRouteParamsSchema>;
