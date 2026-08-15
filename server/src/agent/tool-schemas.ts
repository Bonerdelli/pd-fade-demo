import { graphCameraSchema, lngLatSchema, mapCameraSchema } from "@pd-fade/shared";
import { z } from "zod";

export const searchEntitiesInputSchema = z
  .object({
    query: z.string(),
    kinds: z.array(z.string()).optional(),
    city: z.string().optional(),
  })
  .strict();

export const plotSignalsInputSchema = z
  .object({
    signalIds: z.array(z.string()).optional(),
    area: z.string().optional(),
    keyword: z.string().optional(),
    center: lngLatSchema.optional(),
  })
  .strict();

export const focusInputSchema = z
  .object({
    target: z.enum(["graph", "map"]),
    entityId: z.string().optional(),
    shapeId: z.string().optional(),
    camera: z.union([graphCameraSchema, mapCameraSchema]).optional(),
  })
  .strict();

export type SearchEntitiesInput = z.infer<typeof searchEntitiesInputSchema>;
export type PlotSignalsInput = z.infer<typeof plotSignalsInputSchema>;
export type FocusInput = z.infer<typeof focusInputSchema>;

export const TOOL_NAMES = ["search_entities", "plot_signals", "focus"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

export const anthropicToolDefinitions = [
  {
    name: "search_entities",
    description:
      "Search the Berlin knowledge graph for entities by keyword and kind. Returns matching nodes, edges and layout.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or user intent text" },
        kinds: {
          type: "array",
          items: { type: "string" },
          description: "Optional entity kinds to include, e.g. company, person, location",
        },
        city: { type: "string", description: "Optional city context, usually Berlin" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "plot_signals",
    description:
      "Plot geo activity signals on the map canvas. Filter by signal ids, area name or keyword.",
    input_schema: {
      type: "object",
      properties: {
        signalIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific signal ids to plot",
        },
        area: { type: "string", description: "Area name such as Mitte or Kreuzberg" },
        keyword: { type: "string", description: "Keyword matched against signal labels" },
        center: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
          description: "Optional map center [lng, lat] for the tool result metadata",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "focus",
    description:
      "Suggest a viewport camera move on the graph or map surface. Does not change agent state.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["graph", "map"], description: "Surface to focus" },
        entityId: { type: "string", description: "Graph node id to center on" },
        shapeId: { type: "string", description: "Map shape id to center on" },
        camera: {
          type: "object",
          description: "Explicit camera override for graph {x,y,zoom} or map {center,zoom}",
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
];
