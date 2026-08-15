// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { shouldShowThinkingIndicator } from "./should-show-thinking.js";

describe("shouldShowThinkingIndicator", () => {
  it("is true while running before assistant or tool content", () => {
    expect(
      shouldShowThinkingIndicator("running", [{ kind: "user", id: "u1", text: "hi" }]),
    ).toBe(true);
  });

  it("is false once assistant content arrives", () => {
    expect(
      shouldShowThinkingIndicator("running", [
        { kind: "user", id: "u1", text: "hi" },
        { kind: "assistant", id: "a1", text: "Hello" },
      ]),
    ).toBe(false);
  });

  it("is false when idle", () => {
    expect(shouldShowThinkingIndicator("idle", [])).toBe(false);
  });
});
