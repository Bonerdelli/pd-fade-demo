import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/index.js";
import { createInitialReducerState } from "../store/reducer.js";
import { useCameraCommand } from "./use-camera-command.js";

describe("useCameraCommand", () => {
  it("does not re-apply a viewport command already covered by the event cursor on mount", () => {
    const applyCamera = vi.fn();
    const isProgrammaticMoveRef = { current: false };
    const isUserGesturingRef = { current: false };

    useAppStore.setState({
      ...createInitialReducerState(),
      uiState: {
        ...createInitialReducerState().uiState,
        lastSeq: 10,
        cameraCommand: {
          target: "map",
          seq: 10,
          camera: { center: [13.405, 52.52], zoom: 12.5 },
        },
      },
    });

    renderHook(() =>
      useCameraCommand({
        target: "map",
        applyCamera,
        isProgrammaticMoveRef,
        isUserGesturingRef,
      }),
    );

    expect(applyCamera).not.toHaveBeenCalled();
  });

  it("applies a live viewport command after mount", () => {
    const applyCamera = vi.fn();
    const isProgrammaticMoveRef = { current: false };
    const isUserGesturingRef = { current: false };

    useAppStore.setState({
      ...createInitialReducerState(),
      uiState: {
        ...createInitialReducerState().uiState,
        lastSeq: 14,
        cameraCommand: null,
      },
    });

    const { rerender } = renderHook(() =>
      useCameraCommand({
        target: "map",
        applyCamera,
        isProgrammaticMoveRef,
        isUserGesturingRef,
      }),
    );

    useAppStore.setState((state) => ({
      uiState: {
        ...state.uiState,
        cameraCommand: {
          target: "map",
          seq: 15,
          camera: { center: [13.5, 52.6], zoom: 11 },
        },
      },
    }));

    rerender();

    expect(applyCamera).toHaveBeenCalledWith({ center: [13.5, 52.6], zoom: 11 });
  });
});
