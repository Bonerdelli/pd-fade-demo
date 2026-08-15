import { useEffect, useRef, useState, type RefObject } from "react";
import { AGENT_MOVED_INDICATOR_MS } from "../lib/camera-constants.js";
import {
  shouldApplyCameraCommand,
  shouldConsumeCameraCommandSeq,
} from "../lib/camera-command.js";
import { useAppStore } from "../store/index.js";
import type { ViewportTarget } from "../store/types.js";

export interface UseCameraCommandOptions<TCamera> {
  target: ViewportTarget;
  applyCamera: (camera: TCamera) => void;
  isProgrammaticMoveRef: RefObject<boolean>;
  isUserGesturingRef: RefObject<boolean>;
  indicatorMs?: number;
}

export function useCameraCommand<TCamera>({
  target,
  applyCamera,
  isProgrammaticMoveRef,
  isUserGesturingRef,
  indicatorMs = AGENT_MOVED_INDICATOR_MS,
}: UseCameraCommandOptions<TCamera>) {
  const cameraCommand = useAppStore((state) => state.uiState.cameraCommand);
  const lastSeq = useAppStore((state) => state.uiState.lastSeq);
  const lastConsumedSeqRef = useRef(lastSeq);
  const [showAgentMoved, setShowAgentMoved] = useState(false);

  useEffect(() => {
    if (!shouldConsumeCameraCommandSeq(cameraCommand, target, lastConsumedSeqRef.current)) {
      return;
    }

    const previousConsumedSeq = lastConsumedSeqRef.current;
    lastConsumedSeqRef.current = cameraCommand.seq;

    if (
      !shouldApplyCameraCommand(
        cameraCommand,
        target,
        previousConsumedSeq,
        isUserGesturingRef.current,
      )
    ) {
      return;
    }

    isProgrammaticMoveRef.current = true;
    applyCamera(cameraCommand.camera as TCamera);

    setShowAgentMoved(true);
    const timeout = window.setTimeout(() => {
      setShowAgentMoved(false);
    }, indicatorMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    applyCamera,
    cameraCommand,
    indicatorMs,
    isProgrammaticMoveRef,
    isUserGesturingRef,
    target,
  ]);

  return { showAgentMoved };
}
