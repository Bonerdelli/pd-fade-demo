import type { MapCamera } from "@pd-fade/shared";
import type { CameraCommand } from "../../../store/types.js";

export function isMapCameraCommand(command: CameraCommand | null): command is CameraCommand & {
  target: "map";
  camera: MapCamera;
} {
  return command !== null && command.target === "map";
}

export function shouldApplyCameraCommand(
  command: CameraCommand | null,
  lastConsumedSeq: number,
  isUserGesturing: boolean,
): command is CameraCommand & { target: "map"; camera: MapCamera } {
  if (!isMapCameraCommand(command)) {
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
  if (!command || command.target !== "map") {
    return false;
  }
  return command.seq > lastConsumedSeq;
}
