import { useEffect, type RefObject } from "react";
import type { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
import type { MapShape, Signal } from "@pd-fade/shared";
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
  mapReadyEpoch: number;
  onAgentShapeClick: (selection: AgentShapeSelection) => void;
}

function queryableAgentShapeLayers(map: Map): string[] {
  return AGENT_LAYER_IDS.filter(
    (layerId) => layerId !== AGENT_SIGNALS_LAYER_ID && Boolean(map.getLayer(layerId)),
  );
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

export function syncAgentLayerData(map: Map, agentShapes: MapShape[], agentSignals: Signal[]) {
  ensureAgentLayers(map);

  const shapesSource = map.getSource(AGENT_SHAPES_SOURCE_ID) as GeoJSONSource | undefined;
  shapesSource?.setData(agentShapesToCollection(agentShapes));

  const signalsSource = map.getSource(AGENT_SIGNALS_SOURCE_ID) as GeoJSONSource | undefined;
  signalsSource?.setData(signalsToCollection(agentSignals));
}

export function useAgentLayers({
  mapRef,
  mapReadyEpoch,
  onAgentShapeClick,
}: UseAgentLayersOptions) {
  const agentShapes = useAppStore((state) => state.agentState.map.shapes);
  const agentSignals = useAppStore((state) => state.agentState.map.signals);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncLayers = () => {
      if (!map.isStyleLoaded()) {
        return;
      }
      syncAgentLayerData(map, agentShapes, agentSignals);
    };

    syncLayers();
    map.on("load", syncLayers);

    return () => {
      map.off("load", syncLayers);
    };
  }, [agentShapes, agentSignals, mapReadyEpoch, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const handleClick = (event: MapMouseEvent) => {
      const layers = queryableAgentShapeLayers(map);
      if (layers.length === 0) {
        return;
      }

      const features = map.queryRenderedFeatures(event.point, { layers });

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
  }, [mapReadyEpoch, mapRef, onAgentShapeClick]);
}
