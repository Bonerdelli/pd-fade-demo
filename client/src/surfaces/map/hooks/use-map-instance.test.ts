/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMapInstance } from "./use-map-instance.js";

const mockResize = vi.fn();
const mockRemove = vi.fn();
const mockSetTerrain = vi.fn();
let loadHandler: (() => void) | null = null;
let styleLoadHandler: (() => void) | null = null;
let resizeObserverCallback: ResizeObserverCallback | null = null;

vi.mock("../lib/setup-maplibre-worker.js", () => ({
  setupMaplibreWorker: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    isStyleLoaded() {
      return false;
    }

    once(event: string, handler: () => void) {
      if (event === "load") {
        loadHandler = handler;
      }
    }

    resize = mockResize;
    remove = mockRemove;
    setTerrain = mockSetTerrain;
    on = vi.fn((event: string, handler: () => void) => {
      if (event === "style.load") {
        styleLoadHandler = handler;
      }
    });
    off = vi.fn();

    getCenter() {
      return { lng: 13.405, lat: 52.52 };
    }

    getZoom() {
      return 11;
    }
  }

  return {
    Map: MockMap,
  };
});

describe("useMapInstance", () => {
  beforeEach(() => {
    mockResize.mockClear();
    mockRemove.mockClear();
    mockSetTerrain.mockClear();
    loadHandler = null;
    styleLoadHandler = null;
    resizeObserverCallback = null;

    globalThis.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
    } as unknown as typeof ResizeObserver;

    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    );
  });

  it("waits for map load before ready epoch and resizes on container changes", () => {
    const containerRef = { current: document.createElement("div") };
    Object.defineProperty(containerRef.current, "clientWidth", { value: 640 });
    Object.defineProperty(containerRef.current, "clientHeight", { value: 480 });

    const { result } = renderHook(() =>
      useMapInstance({
        containerRef,
        initialViewport: null,
        onUserViewportChange: vi.fn(),
        isProgrammaticMoveRef: { current: false },
        isUserGesturingRef: { current: false },
      }),
    );

    expect(result.current.mapReadyEpoch).toBe(0);
    expect(result.current.mapErrorKey).toBeNull();
    expect(mockResize).not.toHaveBeenCalled();

    act(() => {
      loadHandler?.();
    });

    expect(result.current.mapReadyEpoch).toBe(1);
    expect(mockSetTerrain).toHaveBeenCalledWith(null);
    expect(mockResize).toHaveBeenCalled();

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(mockResize.mock.calls.length).toBeGreaterThan(1);
  });

  it("skips resize while the container still has zero dimensions", () => {
    const containerRef = { current: document.createElement("div") };
    Object.defineProperty(containerRef.current, "clientWidth", { value: 0 });
    Object.defineProperty(containerRef.current, "clientHeight", { value: 0 });

    renderHook(() =>
      useMapInstance({
        containerRef,
        initialViewport: null,
        onUserViewportChange: vi.fn(),
        isProgrammaticMoveRef: { current: false },
        isUserGesturingRef: { current: false },
      }),
    );

    act(() => {
      loadHandler?.();
    });

    expect(mockResize).not.toHaveBeenCalled();
  });

  it("clears terrain again when the style reloads", () => {
    const containerRef = { current: document.createElement("div") };
    Object.defineProperty(containerRef.current, "clientWidth", { value: 640 });
    Object.defineProperty(containerRef.current, "clientHeight", { value: 480 });

    renderHook(() =>
      useMapInstance({
        containerRef,
        initialViewport: null,
        onUserViewportChange: vi.fn(),
        isProgrammaticMoveRef: { current: false },
        isUserGesturingRef: { current: false },
      }),
    );

    act(() => {
      styleLoadHandler?.();
    });

    expect(mockSetTerrain).toHaveBeenCalledWith(null);
  });
});
