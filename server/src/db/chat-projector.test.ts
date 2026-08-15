import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@pd-fade/shared";
import { createDatabase } from "./database.js";
import { getChatMessages, projectChatEvent } from "./chat-projector.js";
import { SessionStore } from "./session-store.js";

describe("projectChatEvent tool card finalization", () => {
  const sessionId = "chat-projector-session";

  function seedRunningToolCall(db: ReturnType<typeof createDatabase>, toolCallId: string) {
    const store = new SessionStore(db);
    store.ensureSession(sessionId);

    projectChatEvent(db, sessionId, {
      seq: 1,
      runId: "run-1",
      ts: 1,
      type: "TOOL_START",
      toolCallId,
      name: "search",
    } satisfies AgentEvent);
  }

  it("marks in-flight tool cards cancelled on RUN_CANCELLED", () => {
    const db = createDatabase(":memory:");
    seedRunningToolCall(db, "tc-cancel");

    projectChatEvent(db, sessionId, {
      seq: 2,
      runId: "run-1",
      ts: 2,
      type: "RUN_CANCELLED",
    } satisfies AgentEvent);

    const chat = getChatMessages(db, sessionId);
    expect(chat[0]).toMatchObject({ kind: "toolCall", status: "cancelled" });
    db.close();
  });

  it("marks in-flight tool cards error on RUN_ERROR", () => {
    const db = createDatabase(":memory:");
    seedRunningToolCall(db, "tc-error");

    projectChatEvent(db, sessionId, {
      seq: 2,
      runId: "run-1",
      ts: 2,
      type: "RUN_ERROR",
      message: "boom",
    } satisfies AgentEvent);

    const chat = getChatMessages(db, sessionId);
    expect(chat[0]).toMatchObject({ kind: "toolCall", status: "error" });
    db.close();
  });
});
