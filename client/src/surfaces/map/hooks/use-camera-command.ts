import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map } from "maplibre-gl";
import type { MapCamera } from "@pd-fade/shared";
import { useAppStore } from "../../../store/index.js";
import { AGENT_MOVED_INDICATOR_MS } from "../lib/constants.js";
import {
  shouldApplyCameraCommand,
  shouldConsumeCameraCommandSeq,
} from "../lib/camera-command.js";

export interface UseCameraCommandOptions {
  mapRef: RefObject<Map | null>;
  isProgrammaticMoveRef: RefObject<boolean>;
  isUserGesturingRef: RefObject<boolean>;
}

export function useCameraCommand({
  mapRef,
  isProgrammaticMoveRef,
  isUserGesturingRef,
}: UseCameraCommandOptions) {
  const cameraCommand = useAppStore((state) => state.uiState.cameraCommand);
  const lastConsumedSeqRef = useRef(0);
  const [showAgentMoved, setShowAgentMoved] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shouldConsumeCameraCommandSeq(cameraCommand, lastConsumedSeqRef.current)) {
      return;
    }

    lastConsumedSeqRef.current = cameraCommand.seq;

    if (!shouldApplyCameraCommand(cameraCommand, lastConsumedSeqRef.current - 1, isUserGesturingRef.current)) {
      return;
    }

    const camera = cameraCommand.camera as MapCamera;
    isProgrammaticMoveRef.current = true;
    map.flyTo({
      center: camera.center,
      zoom: camera.zoom,
      essential: true,
    });

    setShowAgentMoved(true);
    const timeout = window.setTimeout(() => {
      setShowAgentMoved(false);
    }, AGENT_MOVED_INDICATOR_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cameraCommand, isProgrammaticMoveRef, isUserGesturingRef, mapRef]);

  return { showAgentMoved };
}
