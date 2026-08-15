import type { AgentEvent, AgentState, ChatMessage, SessionStateResponse } from "@pd-fade/shared";
import { applyPatch } from "fast-json-patch";
import type { UiState } from "./types.js";
import { emptyAgentState, emptyUserState, initialUiState } from "./types.js";

export interface ReducerState {
  agentState: AgentState;
  userState: typeof emptyUserState;
  chat: ChatMessage[];
  uiState: UiState;
}

function upsertAssistantText(chat: ChatMessage[], messageId: string, delta: string): ChatMessage[] {
  const index = chat.findIndex((message) => message.kind === "assistant" && message.id === messageId);

  if (index === -1) {
    return [...chat, { kind: "assistant", id: messageId, text: delta }];
  }

  const existing = chat[index];
  if (existing?.kind !== "assistant") {
    return chat;
  }

  const next = [...chat];
  next[index] = { ...existing, text: existing.text + delta };
  return next;
}

function upsertToolCall(
  chat: ChatMessage[],
  toolCallId: string,
  updater: (message: Extract<ChatMessage, { kind: "toolCall" }>) => Extract<
    ChatMessage,
    { kind: "toolCall" }
  >,
): ChatMessage[] {
  const index = chat.findIndex(
    (message) => message.kind === "toolCall" && message.toolCallId === toolCallId,
  );

  if (index === -1) {
    return chat;
  }

  const existing = chat[index];
  if (existing?.kind !== "toolCall") {
    return chat;
  }

  const next = [...chat];
  next[index] = updater(existing);
  return next;
}

function appendToolArgsDelta(
  args: unknown,
  delta: string,
): { argsText: string; parsed: unknown | undefined } {
  const argsText = typeof args === "string" ? args + delta : delta;
  try {
    return { argsText, parsed: JSON.parse(argsText) };
  } catch {
    return { argsText, parsed: undefined };
  }
}

function finalizeInFlightToolCalls(
  chat: ChatMessage[],
  status: Extract<ChatMessage, { kind: "toolCall" }>["status"],
): ChatMessage[] {
  return chat.map((message) => {
    if (message.kind !== "toolCall") {
      return message;
    }
    if (message.status !== "running" && message.status !== "pending") {
      return message;
    }
    return { ...message, status };
  });
}

export function reduceEvent(state: ReducerState, event: AgentEvent): ReducerState {
  switch (event.type) {
    case "RUN_STARTED":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          runStatus: "running",
          currentRunId: event.runId,
          runErrorMessage: null,
        },
      };

    case "RUN_FINISHED":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          runStatus: "idle",
          currentRunId: null,
        },
      };

    case "RUN_ERROR":
      return {
        ...state,
        chat: finalizeInFlightToolCalls(state.chat, "error"),
        uiState: {
          ...state.uiState,
          runStatus: "error",
          currentRunId: event.runId,
          runErrorMessage: event.message,
        },
      };

    case "RUN_CANCELLED":
      return {
        ...state,
        chat: finalizeInFlightToolCalls(state.chat, "cancelled"),
        uiState: {
          ...state.uiState,
          runStatus: "cancelled",
          currentRunId: null,
        },
      };

    case "TEXT_DELTA":
      return {
        ...state,
        chat: upsertAssistantText(state.chat, event.messageId, event.delta),
      };

    case "TOOL_START":
      return {
        ...state,
        chat: [
          ...state.chat,
          {
            kind: "toolCall",
            id: event.toolCallId,
            toolCallId: event.toolCallId,
            name: event.name,
            status: "running",
          },
        ],
      };

    case "TOOL_ARGS":
      return {
        ...state,
        chat: upsertToolCall(state.chat, event.toolCallId, (message) => {
          const { argsText, parsed } = appendToolArgsDelta(message.args, event.delta);
          return {
            ...message,
            args: parsed ?? argsText,
          };
        }),
      };

    case "TOOL_RESULT":
      return {
        ...state,
        chat: upsertToolCall(state.chat, event.toolCallId, (message) => ({
          ...message,
          status: event.status,
          result: event.result,
        })),
      };

    case "STATE_SNAPSHOT":
      return {
        ...state,
        agentState: event.snapshot,
      };

    case "STATE_DELTA": {
      const patched = applyPatch(
        structuredClone(state.agentState),
        event.patch,
        true,
        false,
      ).newDocument as AgentState;
      return {
        ...state,
        agentState: patched,
      };
    }

    case "VIEWPORT_COMMAND":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          cameraCommand: {
            target: event.target,
            camera: event.camera,
            seq: event.seq,
          },
        },
      };

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function createInitialReducerState(): ReducerState {
  return {
    agentState: emptyAgentState,
    userState: emptyUserState,
    chat: [],
    uiState: initialUiState,
  };
}

export function foldEvents(state: ReducerState, events: AgentEvent[]): ReducerState {
  return events.reduce(reduceEvent, state);
}

export function hydrateFromSessionResponse(response: SessionStateResponse): ReducerState {
  const folded = foldEvents(
    {
      ...createInitialReducerState(),
      agentState: response.snapshot,
      userState: response.userState,
      chat: [],
      uiState: {
        ...initialUiState,
        bootstrapStatus: "loading",
      },
    },
    response.tailEvents,
  );

  return {
    ...folded,
    chat: response.chat,
  };
}
