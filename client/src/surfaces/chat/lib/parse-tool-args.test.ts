// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatArgsRaw, parseToolArgs } from "./parse-tool-args.js";

describe("parseToolArgs", () => {
  it("treats truncated JSON strings as streaming while no result exists", () => {
    expect(parseToolArgs('{"query":', false)).toEqual({
      kind: "streaming",
      raw: '{"query":',
    });
  });

  it("parses complete object args", () => {
    expect(parseToolArgs({ query: "berlin" }, false)).toEqual({
      kind: "parsed",
      value: { query: "berlin" },
    });
  });

  it("marks incomplete args as invalid once a result arrives", () => {
    expect(parseToolArgs('{"query":', true)).toEqual({
      kind: "invalid",
      raw: '{"query":',
    });
  });

  it("formats raw args for display", () => {
    expect(formatArgsRaw({ a: 1 })).toContain('"a": 1');
    expect(formatArgsRaw("partial")).toBe("partial");
  });
});
