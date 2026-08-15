import type { CanvasMutation, UserState } from "@pd-fade/shared";
import type Database from "better-sqlite3";
import { emptyUserState } from "./empty-states.js";

function readUserState(db: Database.Database, sessionId: string): UserState {
  const row = db
    .prepare(`SELECT state FROM user_state WHERE session_id = ?`)
    .get(sessionId) as { state: string } | undefined;

  if (!row) {
    return structuredClone(emptyUserState);
  }

  return JSON.parse(row.state) as UserState;
}

function writeUserState(db: Database.Database, sessionId: string, state: UserState): void {
  db.prepare(
    `INSERT INTO user_state (session_id, state) VALUES (?, ?)
     ON CONFLICT(session_id) DO UPDATE SET state = excluded.state`,
  ).run(sessionId, JSON.stringify(state));
}

export function getUserState(db: Database.Database, sessionId: string): UserState {
  return readUserState(db, sessionId);
}

export function applyCanvasMutation(
  db: Database.Database,
  sessionId: string,
  mutation: CanvasMutation,
): UserState {
  const state = readUserState(db, sessionId);

  switch (mutation.type) {
    case "upsertUserShape": {
      const index = state.map.shapes.findIndex((shape) => shape.id === mutation.shape.id);
      if (index >= 0) {
        state.map.shapes[index] = mutation.shape;
      } else {
        state.map.shapes.push(mutation.shape);
      }
      break;
    }
    case "deleteUserShape": {
      state.map.shapes = state.map.shapes.filter((shape) => shape.id !== mutation.shapeId);
      state.comments = state.comments.filter(
        (comment) => comment.targetShapeId !== mutation.shapeId,
      );
      break;
    }
    case "addComment": {
      const index = state.comments.findIndex((comment) => comment.id === mutation.comment.id);
      if (index >= 0) {
        state.comments[index] = mutation.comment;
      } else {
        state.comments.push(mutation.comment);
      }
      break;
    }
    case "setPositionOverride": {
      if (mutation.position === null) {
        delete state.positionOverrides[mutation.nodeId];
      } else {
        state.positionOverrides[mutation.nodeId] = mutation.position;
      }
      break;
    }
    case "clearPositionOverrides": {
      state.positionOverrides = {};
      break;
    }
    case "setSelection": {
      state.selection = mutation.nodeIds;
      break;
    }
    case "setViewport": {
      if (mutation.target === "graph") {
        state.viewports.graph = mutation.camera;
      } else {
        state.viewports.map = mutation.camera;
      }
      break;
    }
  }

  writeUserState(db, sessionId, state);
  return state;
}

export function isRunAllowedCanvasMutation(mutation: CanvasMutation): boolean {
  return mutation.type === "setSelection" || mutation.type === "setViewport";
}
