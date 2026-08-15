import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Map } from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { MapShape } from "@pd-fade/shared";
import { useAppStore } from "../../../store/index.js";
import { drawFeatureToMapShape, mapShapeToDrawFeature, serializeMapShape } from "../lib/geojson.js";

export type DrawToolMode = "select" | "point" | "polygon";

export interface UseDrawToolsOptions {
  mapRef: RefObject<Map | null>;
  isRunLocked: boolean;
  upsertUserShape: (shape: MapShape) => void;
  deleteUserShape: (shapeId: string) => void;
}

const USER_POINT_STYLE = {
  pointColor: "#0f766e" as const,
  pointWidth: 6,
  pointOutlineColor: "#ffffff" as const,
  pointOutlineWidth: 2,
};

const USER_POLYGON_STYLE = {
  fillColor: "#14b8a6" as const,
  fillOpacity: 0.25,
  outlineColor: "#0f766e" as const,
  outlineWidth: 2,
};

const USER_SELECT_STYLE = {
  selectedPointColor: "#0d9488" as const,
  selectedPointWidth: 8,
  selectedPointOutlineColor: "#ffffff" as const,
  selectedPointOutlineWidth: 2,
  selectedPolygonColor: "#14b8a6" as const,
  selectedPolygonFillOpacity: 0.35,
  selectedPolygonOutlineColor: "#0f766e" as const,
  selectedPolygonOutlineWidth: 2,
};

function terraDrawModeForTool(mode: DrawToolMode): string {
  switch (mode) {
    case "point":
      return "point";
    case "polygon":
      return "polygon";
    default:
      return "select";
  }
}

export function useDrawTools({
  mapRef,
  isRunLocked,
  upsertUserShape,
  deleteUserShape,
}: UseDrawToolsOptions) {
  const userShapes = useAppStore((state) => state.userState.map.shapes);
  const drawRef = useRef<TerraDraw | null>(null);
  const activeModeRef = useRef<DrawToolMode>("select");
  const selectedFeatureIdRef = useRef<string | number | null>(null);
  const isRunLockedRef = useRef(isRunLocked);
  const [selectPinnedByLock, setSelectPinnedByLock] = useState(false);
  const [prevRunLocked, setPrevRunLocked] = useState(isRunLocked);
  const syncingFromStoreRef = useRef(false);
  const syncingFromDrawRef = useRef(false);
  const serializedShapesRef = useRef<string>("");
  const [hasSelection, setHasSelection] = useState(false);
  const [drawMode, setDrawModeState] = useState<DrawToolMode>("select");

  if (isRunLocked !== prevRunLocked) {
    setPrevRunLocked(isRunLocked);
    if (isRunLocked) {
      setSelectPinnedByLock(true);
    }
  }

  useEffect(() => {
    isRunLockedRef.current = isRunLocked;
  }, [isRunLocked]);

  useEffect(() => {
    if (!isRunLocked) {
      return;
    }

    activeModeRef.current = "select";

    const draw = drawRef.current;
    if (!draw) {
      return;
    }

    draw.setMode("select");
  }, [isRunLocked]);

  const syncStoreToDraw = useCallback((shapes: MapShape[]) => {
    const draw = drawRef.current;
    if (!draw) {
      return;
    }

    const serialized = shapes
      .map(serializeMapShape)
      .sort()
      .join("|");
    if (serialized === serializedShapesRef.current) {
      return;
    }
    serializedShapesRef.current = serialized;

    syncingFromStoreRef.current = true;

    const snapshot = draw.getSnapshot();
    const storeIds = new Set(shapes.map((shape) => shape.id));

    for (const feature of snapshot) {
      if (feature.id !== undefined && !storeIds.has(String(feature.id))) {
        draw.removeFeatures([feature.id]);
      }
    }

    for (const shape of shapes) {
      const feature = mapShapeToDrawFeature(shape);
      if (draw.hasFeature(shape.id)) {
        draw.updateFeatureGeometry(shape.id, feature.geometry);
      } else {
        draw.addFeatures([feature as unknown as GeoJSONStoreFeatures]);
      }
    }

    syncingFromStoreRef.current = false;
  }, []);

  const publishFeature = useCallback(
    (feature: GeoJSONStoreFeatures) => {
      const shape = drawFeatureToMapShape({
        id: feature.id,
        geometry: feature.geometry as Parameters<typeof drawFeatureToMapShape>[0]["geometry"],
      });
      if (!shape) {
        return;
      }
      syncingFromDrawRef.current = true;
      upsertUserShape(shape);
      syncingFromDrawRef.current = false;
    },
    [upsertUserShape],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    let disposed = false;

    const setupDraw = () => {
      if (disposed || drawRef.current) {
        return;
      }

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawSelectMode({
            flags: {
              point: {
                feature: {
                  draggable: true,
                  coordinates: {
                    draggable: true,
                    midpoints: true,
                    deletable: true,
                  },
                },
              },
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: {
                    draggable: true,
                    midpoints: true,
                    deletable: true,
                  },
                },
              },
            },
            keyEvents: {
              deselect: "Escape",
              delete: "Delete",
              rotate: null,
              scale: null,
            },
            styles: USER_SELECT_STYLE,
          }),
          new TerraDrawPointMode({
            styles: USER_POINT_STYLE,
          }),
          new TerraDrawPolygonMode({
            styles: USER_POLYGON_STYLE,
          }),
        ],
      });

      draw.on("select", (id) => {
        selectedFeatureIdRef.current = id;
        setHasSelection(true);
      });

      draw.on("deselect", () => {
        selectedFeatureIdRef.current = null;
        setHasSelection(false);
      });

      draw.on("finish", (id) => {
        if (syncingFromStoreRef.current || isRunLockedRef.current) {
          return;
        }
        const feature = draw.getSnapshotFeature(id);
        if (feature) {
          publishFeature(feature);
        }
      });

      draw.on("change", (ids, type) => {
        if (syncingFromStoreRef.current || isRunLockedRef.current) {
          return;
        }
        if (type === "delete") {
          for (const id of ids) {
            deleteUserShape(String(id));
          }
          setHasSelection(false);
          return;
        }

        for (const id of ids) {
          const feature = draw.getSnapshotFeature(id);
          if (feature) {
            publishFeature(feature);
          }
        }
      });

      draw.start();
      draw.setMode(terraDrawModeForTool(activeModeRef.current));
      drawRef.current = draw;
    };

    if (map.isStyleLoaded()) {
      setupDraw();
    } else {
      map.once("load", setupDraw);
    }

    return () => {
      disposed = true;
      drawRef.current?.stop();
      drawRef.current = null;
      serializedShapesRef.current = "";
      selectedFeatureIdRef.current = null;
      setHasSelection(false);
    };
  }, [deleteUserShape, mapRef, publishFeature]);

  useEffect(() => {
    if (syncingFromDrawRef.current) {
      return;
    }
    syncStoreToDraw(userShapes);
  }, [syncStoreToDraw, userShapes]);

  const setDrawMode = useCallback(
    (mode: DrawToolMode) => {
      if (isRunLockedRef.current) {
        return;
      }
      setSelectPinnedByLock(false);
      activeModeRef.current = mode;
      setDrawModeState(mode);
      drawRef.current?.setMode(terraDrawModeForTool(mode));
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    const draw = drawRef.current;
    const selectedId = selectedFeatureIdRef.current;
    if (!draw || selectedId === null || isRunLockedRef.current) {
      return;
    }

    draw.removeFeatures([selectedId]);
    deleteUserShape(String(selectedId));
    selectedFeatureIdRef.current = null;
    setHasSelection(false);
  }, [deleteUserShape]);

  const effectiveDrawMode: DrawToolMode = selectPinnedByLock ? "select" : drawMode;

  return {
    drawMode: effectiveDrawMode,
    setDrawMode,
    deleteSelected,
    hasSelection,
  };
}
