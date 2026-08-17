import { describe, expect, it } from "vitest";
import { MAP_STYLE_URL } from "./constants.js";

describe("map constants", () => {
  it("uses OpenFreeMap liberty style for a reliable HTTPS basemap", () => {
    expect(MAP_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/liberty");
  });
});
