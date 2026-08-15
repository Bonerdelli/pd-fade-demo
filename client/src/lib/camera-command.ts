import type { CameraCommand, ViewportTarget } from "../store/types.js";

export function shouldConsumeCameraCommandSeq(
  command: CameraCommand | null,
  target: ViewportTarget,
  lastConsumedSeq: number,
): command is CameraCommand {
  if (!command || command.target !== target) {
    return false;
  }
  return command.seq > lastConsumedSeq;
}

export function shouldApplyCameraCommand(
  command: CameraCommand | null,
  target: ViewportTarget,
  previousConsumedSeq: number,
  isUserGesturing: boolean,
): boolean {
  if (!command || command.target !== target) {
    return false;
  }
  if (command.seq <= previousConsumedSeq) {
    return false;
  }
  if (isUserGesturing) {
    return false;
  }
  return true;
}
