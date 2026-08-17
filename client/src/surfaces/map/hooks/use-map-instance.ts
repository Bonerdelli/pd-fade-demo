import { useEffect, useRef, useState, type RefObject } from "react";
import { Map, type ErrorEvent, type Map as MapInstance } from "maplibre-gl";
import type { MapCamera } from "@pd-fade/shared";
import { DEFAULT_MAP_CAMERA, MAP_STYLE_URL } from "../lib/constants.js";
import { setupMaplibreWorker } from "../lib/setup-maplibre-worker.js";

import "maplibre-gl/dist/maplibre-gl.css";
import "../map.css";

setupMaplibreWorker();

export interface UseMapInstanceOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  initialViewport: MapCamera | null;
  onUserViewportChange: (camera: MapCamera) => void;
  isProgrammaticMoveRef: RefObject<boolean>;
  isUserGesturingRef: RefObject<boolean>;
}

export interface UseMapInstanceResult {
  mapRef: RefObject<MapInstance | null>;
  mapReadyEpoch: number;
  mapErrorKey: string | null;
}

function resizeMapToContainer(map: MapInstance, container: HTMLElement) {
  const { clientWidth, clientHeight } = container;
  if (clientWidth > 0 && clientHeight > 0) {
    map.resize();
  }
}

function scheduleResizeAfterLayout(map: MapInstance, container: HTMLElement) {
  requestAnimationFrame(() => {
    resizeMapToContainer(map, container);
    requestAnimationFrame(() => {
      resizeMapToContainer(map, container);
    });
  });
}

function disableStyleTerrain(map: MapInstance) {
  if (typeof map.setTerrain !== "function") {
    return;
  }

  map.setTerrain(null);
}

export function useMapInstance({
  containerRef,
  initialViewport,
  onUserViewportChange,
  isProgrammaticMoveRef,
  isUserGesturingRef,
}: UseMapInstanceOptions): UseMapInstanceResult {
  const mapRef = useRef<MapInstance | null>(null);
  const initialViewportRef = useRef(initialViewport);
  const onUserViewportChangeRef = useRef(onUserViewportChange);
  const [mapReadyEpoch, setMapReadyEpoch] = useState(0);
  const [mapErrorKey, setMapErrorKey] = useState<string | null>(null);

  useEffect(() => {
    onUserViewportChangeRef.current = onUserViewportChange;
  }, [onUserViewportChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    const camera = initialViewportRef.current ?? DEFAULT_MAP_CAMERA;
    const map = new Map({
      container,
      style: MAP_STYLE_URL,
      center: camera.center,
      zoom: camera.zoom,
      attributionControl: {},
    });

    mapRef.current = map;

    const markMapReady = () => {
      disableStyleTerrain(map);
      scheduleResizeAfterLayout(map, container);
      setMapReadyEpoch((epoch) => epoch + 1);
    };

    const handleMapError = (event: ErrorEvent) => {
      const message = event.error?.message ?? "";
      if (message.includes("Expected number, found null")) {
        return;
      }
      setMapErrorKey("basemap.loadFailed");
    };

    if (map.isStyleLoaded()) {
      markMapReady();
    } else {
      map.once("load", markMapReady);
    }

    map.on("style.load", () => {
      disableStyleTerrain(map);
    });

    map.on("error", handleMapError);

    const resizeObserver = new ResizeObserver(() => {
      resizeMapToContainer(map, container);
    });
    resizeObserver.observe(container);

    const markGestureStart = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) {
        isUserGesturingRef.current = true;
      }
    };

    const markGestureEnd = () => {
      isUserGesturingRef.current = false;
    };

    map.on("dragstart", markGestureStart);
    map.on("zoomstart", markGestureStart);
    map.on("rotatestart", markGestureStart);
    map.on("dragend", markGestureEnd);
    map.on("zoomend", markGestureEnd);
    map.on("rotateend", markGestureEnd);

    map.on("moveend", () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }

      const center = map.getCenter();
      onUserViewportChangeRef.current({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [containerRef, isProgrammaticMoveRef, isUserGesturingRef]);

  return { mapRef, mapReadyEpoch, mapErrorKey };
}
