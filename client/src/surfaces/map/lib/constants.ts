import type { MapCamera } from "@pd-fade/shared";

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export const DEFAULT_MAP_CAMERA: MapCamera = {
  center: [13.405, 52.52],
  zoom: 11,
};

export const AGENT_SHAPES_SOURCE_ID = "agent-shapes";
export const AGENT_SHAPES_FILL_LAYER_ID = "agent-shapes-fill";
export const AGENT_SHAPES_LINE_LAYER_ID = "agent-shapes-line";
export const AGENT_SHAPES_POINT_LAYER_ID = "agent-shapes-point";

export const AGENT_SIGNALS_SOURCE_ID = "agent-signals";
export const AGENT_SIGNALS_LAYER_ID = "agent-signals-layer";

export const AGENT_LAYER_IDS = [
  AGENT_SHAPES_FILL_LAYER_ID,
  AGENT_SHAPES_LINE_LAYER_ID,
  AGENT_SHAPES_POINT_LAYER_ID,
  AGENT_SIGNALS_LAYER_ID,
] as const;
