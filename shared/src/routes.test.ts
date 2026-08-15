import { describe, expect, it } from "vitest";
import {
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionEventsPath,
  sessionMessagesPath,
  sessionStatePath,
} from "./routes.js";

describe("REST path builders", () => {
  it("builds session-scoped paths", () => {
    expect(sessionEventsPath("abc")).toBe("/session/abc/events");
    expect(sessionStatePath("abc")).toBe("/session/abc/state");
    expect(sessionMessagesPath("abc")).toBe("/session/abc/messages");
    expect(sessionCanvasPath("abc")).toBe("/session/abc/canvas");
    expect(sessionCancelRunPath("abc")).toBe("/session/abc/runs/current/cancel");
  });
});
