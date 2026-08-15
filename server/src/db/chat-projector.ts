import type { AgentEvent, ChatMessage } from "@pd-fade/shared";
import type Database from "better-sqlite3";

type ChatRow = {
  session_id: string;
  position: number;
  message_id: string;
  payload: string;
};

function nextChatPosition(db: Database.Database, sessionId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
       FROM chat_messages WHERE session_id = ?`,
    )
    .get(sessionId) as { next_position: number };
  return row.next_position;
}

function upsertChatMessage(
  db: Database.Database,
  sessionId: string,
  messageId: string,
  message: ChatMessage,
  position?: number,
): void {
  const existing = db
    .prepare(`SELECT position FROM chat_messages WHERE session_id = ? AND message_id = ?`)
    .get(sessionId, messageId) as { position: number } | undefined;

  const resolvedPosition = existing?.position ?? position ?? nextChatPosition(db, sessionId);

  db.prepare(
    `INSERT INTO chat_messages (session_id, position, message_id, payload)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, message_id) DO UPDATE SET payload = excluded.payload`,
  ).run(sessionId, resolvedPosition, messageId, JSON.stringify(message));
}

function getToolCallMessage(
  db: Database.Database,
  sessionId: string,
  toolCallId: string,
): ChatMessage | null {
  const row = db
    .prepare(`SELECT payload FROM chat_messages WHERE session_id = ? AND message_id = ?`)
    .get(sessionId, toolCallId) as { payload: string } | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(row.payload) as ChatMessage;
}

function markRunningToolCallsCancelled(db: Database.Database, sessionId: string): void {
  const rows = db
    .prepare(`SELECT message_id, payload FROM chat_messages WHERE session_id = ?`)
    .all(sessionId) as ChatRow[];

  for (const row of rows) {
    const message = JSON.parse(row.payload) as ChatMessage;
    if (message.kind !== "toolCall") {
      continue;
    }
    if (message.status !== "pending" && message.status !== "running") {
      continue;
    }
    upsertChatMessage(db, sessionId, row.message_id, {
      ...message,
      status: "cancelled",
    });
  }
}

export function addUserChatMessage(
  db: Database.Database,
  sessionId: string,
  messageId: string,
  text: string,
): ChatMessage {
  const message: ChatMessage = { kind: "user", id: messageId, text };
  upsertChatMessage(db, sessionId, messageId, message);
  return message;
}

export function projectChatEvent(db: Database.Database, sessionId: string, event: AgentEvent): void {
  switch (event.type) {
    case "TEXT_DELTA": {
      const existing = db
        .prepare(`SELECT payload FROM chat_messages WHERE session_id = ? AND message_id = ?`)
        .get(sessionId, event.messageId) as { payload: string } | undefined;

      if (existing) {
        const message = JSON.parse(existing.payload) as ChatMessage;
        if (message.kind === "assistant") {
          upsertChatMessage(db, sessionId, event.messageId, {
            ...message,
            text: message.text + event.delta,
          });
        }
        return;
      }

      upsertChatMessage(db, sessionId, event.messageId, {
        kind: "assistant",
        id: event.messageId,
        text: event.delta,
      });
      break;
    }
    case "TOOL_START": {
      upsertChatMessage(db, sessionId, event.toolCallId, {
        kind: "toolCall",
        id: event.toolCallId,
        toolCallId: event.toolCallId,
        name: event.name,
        status: "running",
        args: "",
      });
      break;
    }
    case "TOOL_ARGS": {
      const message = getToolCallMessage(db, sessionId, event.toolCallId);
      if (!message || message.kind !== "toolCall") {
        return;
      }
      const argsText = typeof message.args === "string" ? message.args : "";
      upsertChatMessage(db, sessionId, event.toolCallId, {
        ...message,
        args: argsText + event.delta,
      });
      break;
    }
    case "TOOL_RESULT": {
      const message = getToolCallMessage(db, sessionId, event.toolCallId);
      if (!message || message.kind !== "toolCall") {
        return;
      }
      let parsedArgs: unknown = message.args;
      if (typeof message.args === "string" && message.args.length > 0) {
        try {
          parsedArgs = JSON.parse(message.args);
        } catch {
          parsedArgs = message.args;
        }
      }
      upsertChatMessage(db, sessionId, event.toolCallId, {
        ...message,
        status: event.status === "ok" ? "ok" : "error",
        args: parsedArgs,
        result: event.result,
      });
      break;
    }
    case "RUN_CANCELLED": {
      markRunningToolCallsCancelled(db, sessionId);
      break;
    }
    case "RUN_ERROR": {
      markRunningToolCallsCancelled(db, sessionId);
      break;
    }
    default:
      break;
  }
}

export function getChatMessages(db: Database.Database, sessionId: string): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT payload FROM chat_messages
       WHERE session_id = ?
       ORDER BY position ASC`,
    )
    .all(sessionId) as { payload: string }[];

  return rows.map((row) => JSON.parse(row.payload) as ChatMessage);
}
