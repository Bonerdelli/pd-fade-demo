import { useEffect, type RefObject } from "react";
import type { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
import { useAppStore } from "../../../store/index.js";
import {
  AGENT_LAYER_IDS,
  AGENT_SHAPES_FILL_LAYER_ID,
  AGENT_SHAPES_LINE_LAYER_ID,
  AGENT_SHAPES_POINT_LAYER_ID,
  AGENT_SHAPES_SOURCE_ID,
  AGENT_SIGNALS_LAYER_ID,
  AGENT_SIGNALS_SOURCE_ID,
} from "../lib/constants.js";
import { agentShapesToCollection, signalsToCollection } from "../lib/geojson.js";

export interface AgentShapeSelection {
  shapeId: string;
  label: string;
  lngLat: [number, number];
}

export interface UseAgentLayersOptions {
  mapRef: RefObject<Map | null>;
  onAgentShapeClick: (selection: AgentShapeSelection) => void;
}

function ensureAgentLayers(map: Map) {
  if (!map.getSource(AGENT_SHAPES_SOURCE_ID)) {
    map.addSource(AGENT_SHAPES_SOURCE_ID, {
      type: "geojson",
      data: agentShapesToCollection([]),
    });

    map.addLayer({
      id: AGENT_SHAPES_FILL_LAYER_ID,
      type: "fill",
      source: AGENT_SHAPES_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#7c3aed",
        "fill-opacity": 0.2,
      },
    });

    map.addLayer({
      id: AGENT_SHAPES_LINE_LAYER_ID,
      type: "line",
      source: AGENT_SHAPES_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "line-color": "#6d28d9",
        "line-width": 2,
      },
    });

    map.addLayer({
      id: AGENT_SHAPES_POINT_LAYER_ID,
      type: "circle",
      source: AGENT_SHAPES_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#7c3aed",
        "circle-radius": 7,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getSource(AGENT_SIGNALS_SOURCE_ID)) {
    map.addSource(AGENT_SIGNALS_SOURCE_ID, {
      type: "geojson",
      data: signalsToCollection([]),
    });

    map.addLayer({
      id: AGENT_SIGNALS_LAYER_ID,
      type: "circle",
      source: AGENT_SIGNALS_SOURCE_ID,
      paint: {
        "circle-color": "#f59e0b",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "strength"],
          0,
          6,
          1,
          14,
        ],
        "circle-opacity": 0.75,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }
}

export function useAgentLayers({ mapRef, onAgentShapeClick }: UseAgentLayersOptions) {
  const agentShapes = useAppStore((state) => state.agentState.map.shapes);
  const agentSignals = useAppStore((state) => state.agentState.map.signals);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncLayers = () => {
      ensureAgentLayers(map);

      const shapesSource = map.getSource(AGENT_SHAPES_SOURCE_ID) as GeoJSONSource | undefined;
      shapesSource?.setData(agentShapesToCollection(agentShapes));

      const signalsSource = map.getSource(AGENT_SIGNALS_SOURCE_ID) as GeoJSONSource | undefined;
      signalsSource?.setData(signalsToCollection(agentSignals));
    };

    if (map.isStyleLoaded()) {
      syncLayers();
    } else {
      map.once("load", syncLayers);
    }
  }, [agentShapes, agentSignals, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const handleClick = (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [...AGENT_LAYER_IDS].filter((layerId) => layerId !== AGENT_SIGNALS_LAYER_ID),
      });

      const feature = features[0];
      if (!feature?.properties?.shapeId) {
        return;
      }

      onAgentShapeClick({
        shapeId: String(feature.properties.shapeId),
        label: String(feature.properties.label ?? ""),
        lngLat: [event.lngLat.lng, event.lngLat.lat],
      });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [mapRef, onAgentShapeClick]);
}
