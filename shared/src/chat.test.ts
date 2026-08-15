import { describe, it } from "vitest";
import { chatMessageSchema } from "./chat.js";
import { expectInvalid, expectValid } from "./test-helpers.js";

describe("chatMessageSchema union", () => {
  it("parses every message kind", () => {
    expectValid(chatMessageSchema, { kind: "user", id: "m1", text: "hello" });
    expectValid(chatMessageSchema, { kind: "assistant", id: "m2", text: "hi" });
    expectValid(chatMessageSchema, {
      kind: "toolCall",
      id: "m3",
      toolCallId: "tc-1",
      name: "search",
      status: "running",
    });
  });

  it("rejects wrong kind discriminator", () => {
    expectInvalid(chatMessageSchema, { kind: "system", id: "m1", text: "hello" });
    expectInvalid(chatMessageSchema, { kind: "user", id: "m1" });
  });

  it("rejects invalid tool call status", () => {
    expectInvalid(chatMessageSchema, {
      kind: "toolCall",
      id: "m3",
      toolCallId: "tc-1",
      name: "search",
      status: "unknown",
    });
  });
});
