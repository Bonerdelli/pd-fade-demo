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
