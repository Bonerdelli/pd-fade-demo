/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n.js";
import { App } from "./App.js";
import { useAppStore } from "./store/index.js";
import { initialUiState } from "./store/types.js";
import { mutationErrors } from "./lib/mutation-errors.js";

vi.mock("./hooks", () => ({
  useSessionBootstrap: vi.fn(),
}));

vi.mock("./surfaces/graph/GraphPanel.js", () => ({
  GraphPanel: () => <div data-testid="graph-panel">Graph panel</div>,
}));

vi.mock("./surfaces/map/MapPanel.js", () => ({
  MapPanel: () => <div data-testid="map-panel">Map panel</div>,
}));

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("App layout", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", connectionStatus: "connected" },
      retrySessionBootstrap: null,
      startNewSession: null,
    });
  });

  it("does not render the removed app header title", () => {
    renderWithI18n(<App />);

    expect(screen.queryByText("Agent Canvas Demo")).toBeNull();
    expect(screen.queryByText("Connected to agent stream")).toBeNull();
  });

  it("shows bootstrap error in the canvas area with retry", () => {
    const retry = vi.fn();
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "error" },
      retrySessionBootstrap: retry,
    });

    renderWithI18n(<App />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Failed to load session")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("shows mutation error overlay over the active canvas panel", () => {
    useAppStore.setState({
      uiState: {
        ...initialUiState,
        bootstrapStatus: "ready",
        activeCanvasTab: "graph",
        mutationError: mutationErrors.canvasFailed(503),
      },
    });

    renderWithI18n(<App />);

    expect(screen.getByTestId("graph-panel")).toBeTruthy();
    expect(screen.getByText("Canvas mutation failed (503)")).toBeTruthy();
  });
});
