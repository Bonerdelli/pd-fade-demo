// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveLatestToolCallId, shouldExpandByDefault } from "./tool-card-collapse.js";

describe("tool-card-collapse", () => {
  it("resolves the latest tool call id", () => {
    const latest = resolveLatestToolCallId([
      { kind: "user", id: "u1", text: "hi" },
      {
        kind: "toolCall",
        id: "tc-1",
        toolCallId: "tc-1",
        name: "search_entities",
        status: "ok",
      },
      {
        kind: "toolCall",
        id: "tc-2",
        toolCallId: "tc-2",
        name: "plot_signals",
        status: "running",
      },
    ]);

    expect(latest).toBe("tc-2");
  });

  it("expands only the latest card by default", () => {
    expect(shouldExpandByDefault("tc-2", "tc-2")).toBe(true);
    expect(shouldExpandByDefault("tc-1", "tc-2")).toBe(false);
  });
});
