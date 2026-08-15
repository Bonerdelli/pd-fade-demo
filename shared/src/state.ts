import { z } from "zod";
import { lngLatSchema } from "./primitives.js";

export const graphNodeSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const graphEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
  })
  .strict();

export const graphLayoutEntrySchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

export const mapPointShapeSchema = z
  .object({
    id: z.string(),
    kind: z.literal("point"),
    coordinates: lngLatSchema,
    label: z.string().optional(),
  })
  .strict();

export const mapPolygonShapeSchema = z
  .object({
    id: z.string(),
    kind: z.literal("polygon"),
    coordinates: z.array(z.array(lngLatSchema)).min(1),
    label: z.string().optional(),
  })
  .strict();

export const mapShapeSchema = z.discriminatedUnion("kind", [
  mapPointShapeSchema,
  mapPolygonShapeSchema,
]);

export const signalSchema = z
  .object({
    id: z.string(),
    coordinates: lngLatSchema,
    label: z.string(),
    strength: z.number().optional(),
  })
  .strict();

export const agentGraphStateSchema = z
  .object({
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
    layout: z.record(z.string(), graphLayoutEntrySchema),
  })
  .strict();

export const agentMapStateSchema = z
  .object({
    shapes: z.array(mapShapeSchema),
    signals: z.array(signalSchema),
  })
  .strict();

export const agentStateSchema = z
  .object({
    graph: agentGraphStateSchema,
    map: agentMapStateSchema,
  })
  .strict();

export const userCommentSchema = z.object({
  id: z.string(),
  targetShapeId: z.string(),
  text: z.string(),
});

export const userPositionOverrideSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const userViewportsSchema = z.object({
  graph: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .nullable(),
  map: z
    .object({
      center: lngLatSchema,
      zoom: z.number(),
    })
    .nullable(),
});

export const userStateSchema = z.object({
  map: z.object({
    shapes: z.array(mapShapeSchema),
  }),
  comments: z.array(userCommentSchema),
  positionOverrides: z.record(z.string(), userPositionOverrideSchema),
  selection: z.array(z.string()),
  viewports: userViewportsSchema,
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type MapShape = z.infer<typeof mapShapeSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;
export type UserState = z.infer<typeof userStateSchema>;
