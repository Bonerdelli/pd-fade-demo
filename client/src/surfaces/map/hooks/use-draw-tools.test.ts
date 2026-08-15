import { act, renderHook } from "@testing-library/react";
import type { Map } from "maplibre-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapShape } from "@pd-fade/shared";
import { useAppStore } from "../../../store/index.js";
import { emptyUserState } from "../../../store/types.js";
import { useDrawTools } from "./use-draw-tools.js";

const mockAddFeatures = vi.fn();

let deferredLoadHandler: (() => void) | null = null;

vi.mock("terra-draw", () => {
  class MockTerraDraw {
    on = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    setMode = vi.fn();
    getSnapshot = vi.fn(() => []);
    getSnapshotFeature = vi.fn();
    hasFeature = vi.fn(() => false);
    addFeatures = mockAddFeatures;
    removeFeatures = vi.fn();
    updateFeatureGeometry = vi.fn();
  }

  return {
    TerraDraw: MockTerraDraw,
    TerraDrawSelectMode: vi.fn(),
    TerraDrawPointMode: vi.fn(),
    TerraDrawPolygonMode: vi.fn(),
  };
});

vi.mock("terra-draw-maplibre-gl-adapter", () => ({
  TerraDrawMapLibreGLAdapter: vi.fn().mockImplementation(function MockAdapter() {
    return {};
  }),
}));

const hydratedShape: MapShape = {
  id: "user-shape-1",
  kind: "point",
  coordinates: [13.405, 52.52],
};

describe("useDrawTools", () => {
  beforeEach(() => {
    mockAddFeatures.mockClear();
    deferredLoadHandler = null;

    useAppStore.setState({
      userState: {
        ...emptyUserState,
        map: { shapes: [hydratedShape] },
      },
    });
  });

  it("syncs hydrated store shapes after deferred map load setup", () => {
    const map = {
      isStyleLoaded: () => false,
      once: (_event: string, handler: () => void) => {
        deferredLoadHandler = handler;
      },
    } as unknown as Map;

    const mapRef = { current: map };

    renderHook(() =>
      useDrawTools({
        mapRef,
        mapReadyEpoch: 1,
        isRunLocked: false,
        upsertUserShape: vi.fn(),
        deleteUserShape: vi.fn(),
      }),
    );

    expect(mockAddFeatures).not.toHaveBeenCalled();

    act(() => {
      deferredLoadHandler?.();
    });

    expect(mockAddFeatures).toHaveBeenCalledTimes(1);
    expect(mockAddFeatures.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: hydratedShape.id,
          geometry: expect.objectContaining({ type: "Point" }),
        }),
      ]),
    );
  });
});
