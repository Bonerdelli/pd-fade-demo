import {
  agentEventSchema,
  type AgentEvent,
  type AgentState,
} from "@pd-fade/shared";
import type Database from "better-sqlite3";
import { addUserChatMessage, getChatMessages, projectChatEvent } from "./chat-projector.js";
import { emptyAgentState } from "./empty-states.js";
import { applyCanvasMutation, getUserState, isRunAllowedCanvasMutation } from "./user-state.js";

export type AppendEventInput = {
  [E in AgentEvent as E["type"]]: Omit<E, "seq" | "ts">;
}[AgentEvent["type"]];

export class SessionStore {
  constructor(private readonly db: Database.Database) {}

  ensureSession(sessionId: string): void {
    const existing = this.db
      .prepare(`SELECT id FROM sessions WHERE id = ?`)
      .get(sessionId) as { id: string } | undefined;

    if (existing) {
      return;
    }

    this.db
      .prepare(`INSERT INTO sessions (id, created_at) VALUES (?, ?)`)
      .run(sessionId, Date.now());
  }

  appendEvent(sessionId: string, eventInput: AppendEventInput): AgentEvent {
    this.ensureSession(sessionId);

    const append = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
           FROM events WHERE session_id = ?`,
        )
        .get(sessionId) as { next_seq: number };

      const seq = row.next_seq;
      const ts = Date.now();
      const event = agentEventSchema.parse({ ...eventInput, seq, ts });

      this.db
        .prepare(
          `INSERT INTO events (session_id, seq, run_id, ts, type, payload)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionId,
          seq,
          "runId" in event ? event.runId : null,
          ts,
          event.type,
          JSON.stringify(event),
        );

      projectChatEvent(this.db, sessionId, event);

      if (event.type === "STATE_SNAPSHOT") {
        this.saveSnapshot(sessionId, seq, event.snapshot);
      }

      return event;
    });

    return append();
  }

  getEventsAfter(sessionId: string, afterSeq: number): AgentEvent[] {
    const rows = this.db
      .prepare(
        `SELECT payload FROM events
         WHERE session_id = ? AND seq > ?
         ORDER BY seq ASC`,
      )
      .all(sessionId, afterSeq) as { payload: string }[];

    return rows.map((row) => agentEventSchema.parse(JSON.parse(row.payload)));
  }

  getLastSeq(sessionId: string): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(seq), 0) AS last_seq FROM events WHERE session_id = ?`)
      .get(sessionId) as { last_seq: number };

    return row.last_seq;
  }

  getLatestSnapshot(sessionId: string): { seq: number; snapshot: AgentState } | null {
    const row = this.db
      .prepare(
        `SELECT seq, agent_state FROM snapshots
         WHERE session_id = ?
         ORDER BY seq DESC
         LIMIT 1`,
      )
      .get(sessionId) as { seq: number; agent_state: string } | undefined;

    if (!row) {
      return null;
    }

    return {
      seq: row.seq,
      snapshot: JSON.parse(row.agent_state) as AgentState,
    };
  }

  saveSnapshot(sessionId: string, seq: number, snapshot: AgentState): void {
    this.db
      .prepare(
        `INSERT INTO snapshots (session_id, seq, agent_state) VALUES (?, ?, ?)
         ON CONFLICT(session_id, seq) DO UPDATE SET agent_state = excluded.agent_state`,
      )
      .run(sessionId, seq, JSON.stringify(snapshot));
  }

  getAgentState(sessionId: string): AgentState {
    return this.getLatestSnapshot(sessionId)?.snapshot ?? structuredClone(emptyAgentState);
  }

  getUserState(sessionId: string): ReturnType<typeof getUserState> {
    this.ensureSession(sessionId);
    return getUserState(this.db, sessionId);
  }

  applyCanvasMutation(
    sessionId: string,
    mutation: Parameters<typeof applyCanvasMutation>[2],
  ): ReturnType<typeof applyCanvasMutation> {
    this.ensureSession(sessionId);
    return applyCanvasMutation(this.db, sessionId, mutation);
  }

  isRunAllowedCanvasMutation(mutation: Parameters<typeof isRunAllowedCanvasMutation>[0]): boolean {
    return isRunAllowedCanvasMutation(mutation);
  }

  addUserMessage(sessionId: string, messageId: string, text: string) {
    this.ensureSession(sessionId);
    return addUserChatMessage(this.db, sessionId, messageId, text);
  }

  getChat(sessionId: string) {
    this.ensureSession(sessionId);
    return getChatMessages(this.db, sessionId);
  }
}
