import { useEffect, useRef, useState, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { useAppStore } from "../../../store/index.js";
import { AGENT_MOVED_INDICATOR_MS, CAMERA_ANIMATION_MS } from "../lib/constants.js";
import {
  shouldApplyCameraCommand,
  shouldConsumeCameraCommandSeq,
} from "../lib/camera-command.js";

export interface UseGraphCameraCommandOptions {
  isProgrammaticMoveRef: RefObject<boolean>;
  isUserGesturingRef: RefObject<boolean>;
}

export function useGraphCameraCommand({
  isProgrammaticMoveRef,
  isUserGesturingRef,
}: UseGraphCameraCommandOptions) {
  const cameraCommand = useAppStore((state) => state.uiState.cameraCommand);
  const { setViewport } = useReactFlow();
  const lastConsumedSeqRef = useRef(0);
  const [showAgentMoved, setShowAgentMoved] = useState(false);

  useEffect(() => {
    if (!shouldConsumeCameraCommandSeq(cameraCommand, lastConsumedSeqRef.current)) {
      return;
    }

    const previousConsumedSeq = lastConsumedSeqRef.current;
    lastConsumedSeqRef.current = cameraCommand.seq;

    if (
      !shouldApplyCameraCommand(cameraCommand, previousConsumedSeq, isUserGesturingRef.current)
    ) {
      return;
    }

    const camera = cameraCommand.camera;
    isProgrammaticMoveRef.current = true;
    void setViewport(
      { x: camera.x, y: camera.y, zoom: camera.zoom },
      { duration: CAMERA_ANIMATION_MS },
    );

    setShowAgentMoved(true);
    const timeout = window.setTimeout(() => {
      setShowAgentMoved(false);
    }, AGENT_MOVED_INDICATOR_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cameraCommand, isProgrammaticMoveRef, isUserGesturingRef, setViewport]);

  return { showAgentMoved };
}
