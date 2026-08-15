import { useEffect, useRef, type RefObject } from "react";
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

export function useMapInstance({
  containerRef,
  initialViewport,
  onUserViewportChange,
  isProgrammaticMoveRef,
  isUserGesturingRef,
}: UseMapInstanceOptions) {
  const mapRef = useRef<MapInstance | null>(null);
  const initialViewportRef = useRef(initialViewport);

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

    const markGestureStart = () => {
      isUserGesturingRef.current = true;
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
      onUserViewportChange({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [containerRef, isProgrammaticMoveRef, isUserGesturingRef, onUserViewportChange]);

  return mapRef;
}
