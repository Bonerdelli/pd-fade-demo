import { describe, expect, it } from "vitest";
import type { CameraCommand } from "../../../store/types.js";
import {
  shouldApplyCameraCommand,
  shouldConsumeCameraCommandSeq,
} from "./camera-command.js";

const mapCommand: CameraCommand = {
  target: "map",
  camera: { center: [13.405, 52.52], zoom: 12 },
  seq: 5,
};

describe("camera-command", () => {
  it("consumes unseen map commands once", () => {
    expect(shouldConsumeCameraCommandSeq(mapCommand, 4)).toBe(true);
    expect(shouldConsumeCameraCommandSeq(mapCommand, 5)).toBe(false);
    expect(shouldConsumeCameraCommandSeq(mapCommand, 6)).toBe(false);
  });

  it("ignores graph commands", () => {
    expect(
      shouldConsumeCameraCommandSeq(
        {
          target: "graph",
          camera: { x: 0, y: 0, zoom: 1 },
          seq: 10,
        },
        0,
      ),
    ).toBe(false);
  });

  it("applies only fresh map commands while the user is not gesturing", () => {
    expect(shouldApplyCameraCommand(mapCommand, 4, false)).toBe(true);
    expect(shouldApplyCameraCommand(mapCommand, 4, true)).toBe(false);
    expect(shouldApplyCameraCommand(mapCommand, 5, false)).toBe(false);
    expect(shouldApplyCameraCommand(null, 0, false)).toBe(false);
  });
});
