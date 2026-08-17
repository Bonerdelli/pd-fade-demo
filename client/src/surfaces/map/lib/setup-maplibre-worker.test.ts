import { describe, expect, it, vi } from "vitest";
import { setWorkerUrl } from "maplibre-gl";
import { setupMaplibreWorker } from "./setup-maplibre-worker.js";

vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(),
}));

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/bundled-maplibre-worker.js",
}));

describe("setupMaplibreWorker", () => {
  it("points MapLibre at the Vite-bundled worker URL", () => {
    setupMaplibreWorker();
    expect(setWorkerUrl).toHaveBeenCalledWith("/bundled-maplibre-worker.js");
  });
});
