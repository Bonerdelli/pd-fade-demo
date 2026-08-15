// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n.js";
import { useAppStore } from "../../store/index.js";
import { initialUiState } from "../../store/types.js";
import { ChatComposer } from "./ChatComposer.js";
import { ChatHeader } from "./ChatHeader.js";
import { MessageList } from "./MessageList.js";
import { ToolCard } from "./ToolCard.js";

vi.mock("../../hooks/use-mutations.js", () => ({
  useMutations: () => ({
    sendMessage: vi.fn(),
    cancelRun: vi.fn(),
  }),
}));

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("Chat surface components", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      chat: [],
      uiState: { ...initialUiState, bootstrapStatus: "ready", connectionStatus: "connected" },
    });
  });

  it("renders streaming assistant text", () => {
    useAppStore.setState({
      chat: [
        { kind: "user", id: "u1", text: "hello" },
        { kind: "assistant", id: "a1", text: "Hel" },
      ],
    });

    renderWithI18n(<MessageList />);

    expect(screen.getByText("Hel")).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("shows tool card lifecycle from running to ok", () => {
    const { rerender } = renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-1",
          toolCallId: "tc-1",
          name: "search_entities",
          status: "running",
          args: '{"query":"berlin"',
        }}
        isExpanded={true}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Receiving arguments/i)).toBeTruthy();

    rerender(
      <I18nextProvider i18n={i18n}>
        <ToolCard
          message={{
            kind: "toolCall",
            id: "tc-1",
            toolCallId: "tc-1",
            name: "search_entities",
            status: "ok",
            args: { query: "berlin", kinds: ["company"], city: "Berlin" },
            result: { matchCount: 8, entities: [], edges: [] },
          }}
          isExpanded={true}
          onToggle={() => undefined}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText(/Found 8 entities/i)).toBeTruthy();
  });

  it("renders fallback card for unknown tools", () => {
    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-x",
          toolCallId: "tc-x",
          name: "mystery_tool",
          status: "ok",
          args: { payload: true },
          result: { ok: true },
        }}
        isExpanded={true}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Agent executed mystery_tool/i)).toBeTruthy();
  });

  it("renders debug mode toggle in chat header", async () => {
    const user = userEvent.setup();

    renderWithI18n(<ChatHeader />);

    const toggle = screen.getByRole("checkbox", { name: /Debug Mode/i });
    expect(toggle).toBeTruthy();
    expect((toggle as HTMLInputElement).checked).toBe(false);

    await user.click(toggle);
    expect(useAppStore.getState().uiState.debugMode).toBe(true);
    expect((toggle as HTMLInputElement).checked).toBe(true);

    await user.click(toggle);
    expect(useAppStore.getState().uiState.debugMode).toBe(false);
  });

  it("hides raw fallback tool args when debug mode is off", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", debugMode: false },
    });

    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-hidden",
          toolCallId: "tc-hidden",
          name: "mystery_tool",
          status: "ok",
          args: { payload: true },
          result: { ok: true },
        }}
        isExpanded={true}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Agent executed mystery_tool/i)).toBeTruthy();
    expect(screen.queryByText(/"payload"/)).toBeNull();
    expect(screen.queryByText(/Arguments/i)).toBeNull();
  });

  it("hides plot signals center coordinates when debug mode is off", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", debugMode: false },
    });

    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-plot-hidden",
          toolCallId: "tc-plot-hidden",
          name: "plot_signals",
          status: "ok",
          args: { signalIds: ["s1", "s2", "s3"], center: [13.405, 52.52] },
          result: { plotted: 3 },
        }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Plotted 3 signals/i)).toBeTruthy();
    expect(screen.queryByText(/Expand/i)).toBeNull();
    expect(screen.queryByText(/3 selected/i)).toBeNull();
    expect(screen.queryByText(/13\.405/)).toBeNull();
  });

  it("shows plot signals expand control when debug mode reveals center", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", debugMode: true },
    });

    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-plot-visible",
          toolCallId: "tc-plot-visible",
          name: "plot_signals",
          status: "ok",
          args: { signalIds: ["s1", "s2", "s3"], center: [13.405, 52.52] },
          result: { plotted: 3 },
        }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Expand/i)).toBeTruthy();
  });

  it("shows plot signals center coordinates when debug mode is on and expanded", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", debugMode: true },
    });

    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-plot-visible",
          toolCallId: "tc-plot-visible",
          name: "plot_signals",
          status: "ok",
          args: { signalIds: ["s1", "s2", "s3"], center: [13.405, 52.52] },
          result: { plotted: 3 },
        }}
        isExpanded={true}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/13\.405, 52\.52/)).toBeTruthy();
    expect(screen.getByText(/Center:/i)).toBeTruthy();
  });

  it("shows expand control for search entity tool cards", () => {
    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-search",
          toolCallId: "tc-search",
          name: "search_entities",
          status: "ok",
          args: { query: "berlin", kinds: ["company"], city: "Berlin" },
          result: { matchCount: 8, entities: [], edges: [] },
        }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Expand/i)).toBeTruthy();
  });

  it("shows expand control for errored fallback tool cards", () => {
    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-error",
          toolCallId: "tc-error",
          name: "mystery_tool",
          status: "error",
          args: { payload: true },
          result: { message: "boom" },
        }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/Expand/i)).toBeTruthy();
    expect(screen.getByText(/mystery_tool failed/i)).toBeTruthy();
  });

  it("shows raw fallback tool args when debug mode is on", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", debugMode: true },
    });

    renderWithI18n(
      <ToolCard
        message={{
          kind: "toolCall",
          id: "tc-visible",
          toolCallId: "tc-visible",
          name: "mystery_tool",
          status: "ok",
          args: { payload: true },
          result: { ok: true },
        }}
        isExpanded={true}
        onToggle={() => undefined}
      />,
    );

    expect(screen.getByText(/"payload": true/)).toBeTruthy();
  });

  it("pins the composer action button to the top of the input row", () => {
    renderWithI18n(<ChatComposer />);

    const input = screen.getByLabelText(/Message input/i);
    const row = input.parentElement;

    expect(row?.className).toContain("items-start");
    expect((input as HTMLTextAreaElement).rows).toBe(1);
    expect(input.className).toContain("min-h-9");
  });

  it("shows Stop button while a run is active", () => {
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", runStatus: "running" },
    });

    renderWithI18n(<ChatComposer />);

    expect(screen.getByRole("button", { name: /Stop/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Send$/i })).toBeNull();
  });

  it("does not submit on Enter while running", async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      uiState: { ...initialUiState, bootstrapStatus: "ready", runStatus: "running" },
    });

    renderWithI18n(<ChatComposer />);

    const input = screen.getByLabelText(/Message input/i);
    await user.type(input, "next question{enter}");

    expect((input as HTMLTextAreaElement).value).toBe("next question");
  });
});
