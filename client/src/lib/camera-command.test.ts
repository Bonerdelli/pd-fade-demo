import { describe, expect, it } from "vitest";
import type { CameraCommand } from "../store/types.js";
import { shouldApplyCameraCommand, shouldConsumeCameraCommandSeq } from "./camera-command.js";

const graphCommand: CameraCommand = {
  target: "graph",
  camera: { x: 120, y: 80, zoom: 1.25 },
  seq: 7,
};

const mapCommand: CameraCommand = {
  target: "map",
  camera: { center: [13.405, 52.52], zoom: 12 },
  seq: 5,
};

describe("shouldConsumeCameraCommandSeq", () => {
  it("consumes unseen commands for the requested target once", () => {
    expect(shouldConsumeCameraCommandSeq(graphCommand, "graph", 6)).toBe(true);
    expect(shouldConsumeCameraCommandSeq(graphCommand, "graph", 7)).toBe(false);
    expect(shouldConsumeCameraCommandSeq(mapCommand, "map", 4)).toBe(true);
    expect(shouldConsumeCameraCommandSeq(mapCommand, "map", 5)).toBe(false);
  });

  it("ignores commands for other targets", () => {
    expect(shouldConsumeCameraCommandSeq(graphCommand, "map", 0)).toBe(false);
    expect(shouldConsumeCameraCommandSeq(mapCommand, "graph", 0)).toBe(false);
  });
});

describe("shouldApplyCameraCommand", () => {
  it("applies only fresh commands while the user is not gesturing", () => {
    expect(shouldApplyCameraCommand(graphCommand, "graph", 6, false)).toBe(true);
    expect(shouldApplyCameraCommand(graphCommand, "graph", 6, true)).toBe(false);
    expect(shouldApplyCameraCommand(graphCommand, "graph", 7, false)).toBe(false);
    expect(shouldApplyCameraCommand(mapCommand, "map", 4, false)).toBe(true);
    expect(shouldApplyCameraCommand(mapCommand, "graph", 4, false)).toBe(false);
    expect(shouldApplyCameraCommand(null, "graph", 0, false)).toBe(false);
  });
});
