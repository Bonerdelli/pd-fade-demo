import { describe, expect, it } from "vitest";
import { MAP_STYLE_URL } from "./constants.js";

describe("map constants", () => {
  it("uses a bundled raster basemap style that paints without vector tile workers", () => {
    expect(MAP_STYLE_URL).toBe("/map/raster-basemap-style.json");
  });
});
