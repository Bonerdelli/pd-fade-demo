/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n.js";
import { GraphEmptyState } from "./components/GraphEmptyState.js";
import { hasLayoutDivergence } from "./lib/positions.js";

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("GraphEmptyState", () => {
  it("renders localized empty message", () => {
    renderWithI18n(<GraphEmptyState />);
    expect(screen.getByText("The agent has not built a graph yet")).toBeTruthy();
  });
});

describe("graph surface helpers", () => {
  it("detects layout divergence for realign visibility", () => {
    expect(
      hasLayoutDivergence(
        { "node-1": { x: 50, y: 50 } },
        { "node-1": { x: 0, y: 0 } },
      ),
    ).toBe(true);
  });
});
