// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@pd-fade/shared";
import { useToolCardExpandedState } from "./use-tool-card-expanded.js";

const toolCall = (
  toolCallId: string,
  name = "search_entities",
): Extract<ChatMessage, { kind: "toolCall" }> => ({
  kind: "toolCall",
  id: toolCallId,
  toolCallId,
  name,
  status: "ok",
  args: { query: "berlin" },
  result: { matchCount: 1, entities: [], edges: [] },
});

describe("useToolCardExpandedState", () => {
  it("keeps a non-latest card expanded after toggling Expand", () => {
    const chat: ChatMessage[] = [toolCall("tc-1"), toolCall("tc-2", "plot_signals")];

    const { result } = renderHook(({ messages }) => useToolCardExpandedState(messages), {
      initialProps: { messages: chat },
    });

    expect(result.current.isExpanded("tc-1")).toBe(false);
    expect(result.current.isExpanded("tc-2")).toBe(true);

    act(() => {
      result.current.toggleExpanded("tc-1");
    });

    expect(result.current.isExpanded("tc-1")).toBe(true);
    expect(result.current.isExpanded("tc-2")).toBe(true);
  });

  it("collapses and re-expands the latest card", () => {
    const chat: ChatMessage[] = [toolCall("tc-latest")];

    const { result } = renderHook(({ messages }) => useToolCardExpandedState(messages), {
      initialProps: { messages: chat },
    });

    expect(result.current.isExpanded("tc-latest")).toBe(true);

    act(() => {
      result.current.toggleExpanded("tc-latest");
    });

    expect(result.current.isExpanded("tc-latest")).toBe(false);

    act(() => {
      result.current.toggleExpanded("tc-latest");
    });

    expect(result.current.isExpanded("tc-latest")).toBe(true);
  });
});
