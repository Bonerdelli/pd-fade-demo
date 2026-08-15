import { describe, expect, it } from "vitest";
import type { CameraCommand } from "../../../store/types.js";
import {
  shouldApplyCameraCommand,
  shouldConsumeCameraCommandSeq,
} from "./camera-command.js";

const graphCommand: CameraCommand = {
  target: "graph",
  camera: { x: 120, y: 80, zoom: 1.25 },
  seq: 7,
};

describe("graph camera-command", () => {
  it("consumes unseen graph commands once", () => {
    expect(shouldConsumeCameraCommandSeq(graphCommand, 6)).toBe(true);
    expect(shouldConsumeCameraCommandSeq(graphCommand, 7)).toBe(false);
    expect(shouldConsumeCameraCommandSeq(graphCommand, 8)).toBe(false);
  });

  it("ignores map commands", () => {
    expect(
      shouldConsumeCameraCommandSeq(
        {
          target: "map",
          camera: { center: [0, 0], zoom: 1 },
          seq: 10,
        },
        0,
      ),
    ).toBe(false);
  });

  it("applies only fresh graph commands while the user is not gesturing", () => {
    expect(shouldApplyCameraCommand(graphCommand, 6, false)).toBe(true);
    expect(shouldApplyCameraCommand(graphCommand, 6, true)).toBe(false);
    expect(shouldApplyCameraCommand(graphCommand, 7, false)).toBe(false);
    expect(shouldApplyCameraCommand(null, 0, false)).toBe(false);
  });
});
