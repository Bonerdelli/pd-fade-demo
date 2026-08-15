/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n.js";
import { CanvasErrorOverlay } from "./CanvasErrorOverlay.js";

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("CanvasErrorOverlay", () => {
  it("renders centered error message", () => {
    renderWithI18n(<CanvasErrorOverlay message="Something went wrong" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders retry button and calls handler", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderWithI18n(
      <CanvasErrorOverlay message="Failed to load session" onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
