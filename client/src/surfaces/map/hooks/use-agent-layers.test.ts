import { act, renderHook } from "@testing-library/react";
import type { Map, MapMouseEvent } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import type { MapShape, Signal } from "@pd-fade/shared";
import {
  AGENT_SHAPES_FILL_LAYER_ID,
  AGENT_SHAPES_SOURCE_ID,
  AGENT_SIGNALS_SOURCE_ID,
} from "../lib/constants.js";
import { syncAgentLayerData, useAgentLayers } from "./use-agent-layers.js";

const agentShape: MapShape = {
  id: "hq",
  kind: "point",
  label: "TechBerlin HQ",
  coordinates: [13.405, 52.52],
};

const agentSignal: Signal = {
  id: "signal-1",
  label: "Kreuzberg cluster",
  coordinates: [13.42, 52.49],
  strength: 0.8,
};

vi.mock("../../../store/index.js", () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      agentState: {
        map: {
          shapes: [agentShape],
          signals: [agentSignal],
        },
      },
    }),
}));

describe("useAgentLayers", () => {
  it("re-syncs agent overlay data when the map instance epoch changes", () => {
    const shapesSetData = vi.fn();
    const signalsSetData = vi.fn();
    const sourceStore = new globalThis.Map<string, { setData: ReturnType<typeof vi.fn> }>([
      [AGENT_SHAPES_SOURCE_ID, { setData: shapesSetData }],
      [AGENT_SIGNALS_SOURCE_ID, { setData: signalsSetData }],
    ]);

    const map = {
      isStyleLoaded: () => true,
      getSource: (sourceId: string) => sourceStore.get(sourceId),
      getLayer: (layerId: string) => (layerId === AGENT_SHAPES_FILL_LAYER_ID ? {} : undefined),
      addSource: vi.fn((sourceId: string) => {
        const entry = { setData: vi.fn() };
        sourceStore.set(sourceId, entry);
        if (sourceId === AGENT_SHAPES_SOURCE_ID) {
          shapesSetData.mockImplementation(entry.setData);
        }
        if (sourceId === AGENT_SIGNALS_SOURCE_ID) {
          signalsSetData.mockImplementation(entry.setData);
        }
      }),
      addLayer: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      queryRenderedFeatures: vi.fn(() => []),
    } as unknown as Map;

    const mapRef = { current: map };

    const { rerender } = renderHook(
      ({ mapReadyEpoch }) =>
        useAgentLayers({
          mapRef,
          mapReadyEpoch,
          onAgentShapeClick: vi.fn(),
        }),
      { initialProps: { mapReadyEpoch: 1 } },
    );

    expect(shapesSetData).toHaveBeenCalled();
    expect(signalsSetData).toHaveBeenCalled();
    shapesSetData.mockClear();
    signalsSetData.mockClear();

    rerender({ mapReadyEpoch: 2 });

    expect(shapesSetData).toHaveBeenCalled();
    expect(signalsSetData).toHaveBeenCalled();
  });

  it("does not clear agent overlay data when clicking empty map space", () => {
    const shapesSetData = vi.fn();
    const signalsSetData = vi.fn();
    let clickHandler: ((event: MapMouseEvent) => void) | null = null;

    const map = {
      isStyleLoaded: () => true,
      getSource: (sourceId: string) => {
        if (sourceId === AGENT_SHAPES_SOURCE_ID) {
          return { setData: shapesSetData };
        }
        if (sourceId === AGENT_SIGNALS_SOURCE_ID) {
          return { setData: signalsSetData };
        }
        return undefined;
      },
      getLayer: (layerId: string) => (layerId === AGENT_SHAPES_FILL_LAYER_ID ? {} : undefined),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      on: vi.fn((event: string, handler: (event: MapMouseEvent) => void) => {
        if (event === "click") {
          clickHandler = handler;
        }
      }),
      off: vi.fn(),
      queryRenderedFeatures: vi.fn(() => []),
    } as unknown as Map;

    renderHook(() =>
      useAgentLayers({
        mapRef: { current: map },
        mapReadyEpoch: 1,
        onAgentShapeClick: vi.fn(),
      }),
    );

    shapesSetData.mockClear();
    signalsSetData.mockClear();

    act(() => {
      clickHandler?.({
        point: { x: 10, y: 10 },
        lngLat: { lng: 13.4, lat: 52.5 },
      } as MapMouseEvent);
    });

    expect(shapesSetData).not.toHaveBeenCalled();
    expect(signalsSetData).not.toHaveBeenCalled();
  });
});

describe("syncAgentLayerData", () => {
  it("writes current agent shapes and signals into map sources", () => {
    const shapesSetData = vi.fn();
    const signalsSetData = vi.fn();

    const map = {
      getSource: (sourceId: string) => {
        if (sourceId === AGENT_SHAPES_SOURCE_ID) {
          return { setData: shapesSetData };
        }
        if (sourceId === AGENT_SIGNALS_SOURCE_ID) {
          return { setData: signalsSetData };
        }
        return undefined;
      },
      addSource: vi.fn(function addSource(sourceId: string) {
        if (sourceId === AGENT_SHAPES_SOURCE_ID) {
          return { setData: shapesSetData };
        }
        if (sourceId === AGENT_SIGNALS_SOURCE_ID) {
          return { setData: signalsSetData };
        }
        return undefined;
      }),
      addLayer: vi.fn(),
    } as unknown as Map;

    syncAgentLayerData(map, [agentShape], [agentSignal]);

    expect(shapesSetData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ shapeId: "hq" }),
          }),
        ]),
      }),
    );
    expect(signalsSetData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ signalId: "signal-1" }),
          }),
        ]),
      }),
    );
  });
});
