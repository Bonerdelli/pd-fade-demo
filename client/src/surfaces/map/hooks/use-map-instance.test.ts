/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMapInstance } from "./use-map-instance.js";

const mockResize = vi.fn();
const mockRemove = vi.fn();
let loadHandler: (() => void) | null = null;
let resizeObserverCallback: ResizeObserverCallback | null = null;

vi.mock("maplibre-gl", () => {
  class MockMap {
    isStyleLoaded() {
      return false;
    }

    once(_event: string, handler: () => void) {
      loadHandler = handler;
    }

    resize = mockResize;
    remove = mockRemove;
    on = vi.fn();
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
    loadHandler = null;
    resizeObserverCallback = null;

    globalThis.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
    } as unknown as typeof ResizeObserver;
  });

  it("waits for map load before ready epoch and resizes on container changes", () => {
    const containerRef = { current: document.createElement("div") };

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
    expect(mockResize).not.toHaveBeenCalled();

    act(() => {
      loadHandler?.();
    });

    expect(result.current.mapReadyEpoch).toBe(1);
    expect(mockResize).toHaveBeenCalledTimes(1);

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(mockResize).toHaveBeenCalledTimes(2);
  });
});
