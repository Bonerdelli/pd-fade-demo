import type { GraphCamera } from "@pd-fade/shared";
import type { CameraCommand } from "../../../store/types.js";

export function isGraphCameraCommand(command: CameraCommand | null): command is CameraCommand & {
  target: "graph";
  camera: GraphCamera;
} {
  return command !== null && command.target === "graph";
}

export function shouldApplyCameraCommand(
  command: CameraCommand | null,
  lastConsumedSeq: number,
  isUserGesturing: boolean,
): command is CameraCommand & { target: "graph"; camera: GraphCamera } {
  if (!isGraphCameraCommand(command)) {
    return false;
  }
  if (command.seq <= lastConsumedSeq) {
    return false;
  }
  if (isUserGesturing) {
    return false;
  }
  return true;
}

export function shouldConsumeCameraCommandSeq(
  command: CameraCommand | null,
  lastConsumedSeq: number,
): command is CameraCommand {
  if (!command || command.target !== "graph") {
    return false;
  }
  return command.seq > lastConsumedSeq;
}
