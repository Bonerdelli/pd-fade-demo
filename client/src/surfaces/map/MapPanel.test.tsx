import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n.js";
import { MapPanel } from "./MapPanel.js";

vi.mock("maplibre-gl", () => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  class MockMap {
    isStyleLoaded() {
      return true;
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(handler);
      listeners.set(event, bucket);
    }

    off(event: string, handler: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(handler);
    }

    once(event: string, handler: (...args: unknown[]) => void) {
      handler();
    }

    remove() {
      listeners.clear();
    }

    getCenter() {
      return { lng: 13.405, lat: 52.52 };
    }

    getZoom() {
      return 11;
    }

    flyTo() {
      return undefined;
    }

    getSource() {
      return undefined;
    }

    addSource() {
      return undefined;
    }

    addLayer() {
      return undefined;
    }

    queryRenderedFeatures() {
      return [];
    }
  }

  return {
    Map: MockMap,
  };
});

vi.mock("terra-draw", () => {
  class MockTerraDraw {
    on = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    setMode = vi.fn();
    getSnapshot = vi.fn(() => []);
    getSnapshotFeature = vi.fn();
    hasFeature = vi.fn(() => false);
    addFeatures = vi.fn();
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

vi.mock("../../hooks/index.js", () => ({
  useRunLock: () => false,
  useMutations: () => ({
    upsertUserShape: vi.fn(),
    deleteUserShape: vi.fn(),
    addComment: vi.fn(),
    setViewport: vi.fn(),
  }),
}));

vi.mock("../../store/index.js", () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      userState: {
        viewports: { map: null },
        comments: [],
        map: { shapes: [] },
      },
      agentState: {
        map: { shapes: [], signals: [] },
      },
      uiState: {
        cameraCommand: null,
      },
    }),
}));

describe("MapPanel", () => {
  it("mounts the map shell and toolbar", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MapPanel />
      </I18nextProvider>,
    );

    expect(screen.getByTestId("map-container")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Point" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Polygon" })).toBeTruthy();
  });
});
