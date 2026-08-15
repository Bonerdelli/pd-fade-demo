/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n.js";
import { CanvasSurfaceErrorBoundary } from "./CanvasSurfaceErrorBoundary.js";

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

function ThrowOnRender(): never {
  throw new Error("map mount failed");
}

describe("CanvasSurfaceErrorBoundary", () => {
  it("shows localized fallback and remounts children on retry", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) {
        throw new Error("map mount failed");
      }
      return <p>Map recovered</p>;
    }

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderWithI18n(
      <CanvasSurfaceErrorBoundary surface="map">
        <MaybeThrow />
      </CanvasSurfaceErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Map canvas failed to load")).toBeTruthy();

    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Map recovered")).toBeTruthy();

    consoleError.mockRestore();
  });

  it("logs render errors from child components", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderWithI18n(
      <CanvasSurfaceErrorBoundary surface="graph">
        <ThrowOnRender />
      </CanvasSurfaceErrorBoundary>,
    );

    expect(screen.getByText("Graph canvas failed to load")).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
