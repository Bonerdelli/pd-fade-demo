import { useEffect, useRef, useState, type RefObject } from "react";
import { Map, type Map as MapInstance } from "maplibre-gl";
import type { MapCamera } from "@pd-fade/shared";
import { DEFAULT_MAP_CAMERA, MAP_STYLE_URL } from "../lib/constants.js";

import "maplibre-gl/dist/maplibre-gl.css";

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
      map.resize();
      setMapReadyEpoch((epoch) => epoch + 1);
    };

    if (map.isStyleLoaded()) {
      markMapReady();
    } else {
      map.once("load", markMapReady);
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
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

  return { mapRef, mapReadyEpoch };
}
