import { z } from "zod";

export const lngLatSchema = z.tuple([z.number(), z.number()]);

export const graphCameraSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const mapCameraSchema = z.object({
  center: lngLatSchema,
  zoom: z.number(),
});

export type LngLat = z.infer<typeof lngLatSchema>;
export type GraphCamera = z.infer<typeof graphCameraSchema>;
export type MapCamera = z.infer<typeof mapCameraSchema>;

export const jsonPatchAddOpSchema = z.object({
  op: z.literal("add"),
  path: z.string(),
  value: z.unknown(),
});

export const jsonPatchRemoveOpSchema = z.object({
  op: z.literal("remove"),
  path: z.string(),
});

export const jsonPatchReplaceOpSchema = z.object({
  op: z.literal("replace"),
  path: z.string(),
  value: z.unknown(),
});

export const jsonPatchOpSchema = z.discriminatedUnion("op", [
  jsonPatchAddOpSchema,
  jsonPatchRemoveOpSchema,
  jsonPatchReplaceOpSchema,
]);

export type JsonPatchOp = z.infer<typeof jsonPatchOpSchema>;
