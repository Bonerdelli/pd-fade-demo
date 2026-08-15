import {
  postCanvasRequestSchema,
  postMessageRequestSchema,
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionMessagesPath,
  type CanvasMutation,
  type ChatMessage,
  type UserState,
} from "@pd-fade/shared";
import { apiUrl } from "./api-base.js";
import { createCoalescingFlusher, createDebouncer } from "./debounce.js";
import { mutationErrors, type MutationError } from "./mutation-errors.js";

const BLOCKED_ON_CONFLICT: CanvasMutation["type"][] = [
  "upsertUserShape",
  "deleteUserShape",
  "addComment",
  "setPositionOverride",
  "clearPositionOverrides",
];

export interface MutationStore {
  getSessionId: () => string | null;
  getUserState: () => UserState;
  replaceUserState: (userState: UserState) => void;
  appendChatMessage: (message: ChatMessage) => void;
  removeChatMessage: (messageId: string) => void;
  setMutationError: (error: MutationError | null) => void;
}

export interface MutationController {
  sendMessage: (text: string) => Promise<void>;
  upsertUserShape: (shape: Extract<CanvasMutation, { type: "upsertUserShape" }>["shape"]) => void;
  deleteUserShape: (shapeId: string) => void;
  addComment: (comment: Extract<CanvasMutation, { type: "addComment" }>["comment"]) => void;
  setPositionOverride: (
    nodeId: string,
    position: Extract<CanvasMutation, { type: "setPositionOverride" }>["position"],
  ) => void;
  clearPositionOverrides: () => void;
  setSelection: (nodeIds: string[]) => void;
  setViewport: (mutation: Extract<CanvasMutation, { type: "setViewport" }>) => void;
  cancelRun: () => Promise<void>;
  dispose: () => void;
}

async function postWithRetry(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const attempt = async () =>
    fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let response = await attempt();
  if (!response.ok && response.status >= 500) {
    response = await attempt();
  }
  return response;
}

function applyCanvasMutationLocally(userState: UserState, mutation: CanvasMutation): UserState {
  switch (mutation.type) {
    case "upsertUserShape": {
      const shapes = userState.map.shapes.filter((shape) => shape.id !== mutation.shape.id);
      return {
        ...userState,
        map: { shapes: [...shapes, mutation.shape] },
      };
    }
    case "deleteUserShape":
      return {
        ...userState,
        map: {
          shapes: userState.map.shapes.filter((shape) => shape.id !== mutation.shapeId),
        },
        comments: userState.comments.filter(
          (comment) => comment.targetShapeId !== mutation.shapeId,
        ),
      };
    case "addComment":
      return {
        ...userState,
        comments: [...userState.comments, mutation.comment],
      };
    case "setPositionOverride": {
      const positionOverrides = { ...userState.positionOverrides };
      if (mutation.position === null) {
        delete positionOverrides[mutation.nodeId];
      } else {
        positionOverrides[mutation.nodeId] = mutation.position;
      }
      return { ...userState, positionOverrides };
    }
    case "clearPositionOverrides":
      return { ...userState, positionOverrides: {} };
    case "setSelection":
      return { ...userState, selection: mutation.nodeIds };
    case "setViewport":
      return {
        ...userState,
        viewports: {
          ...userState.viewports,
          [mutation.target]: mutation.camera,
        },
      };
    default: {
      const _exhaustive: never = mutation;
      return _exhaustive;
    }
  }
}

async function postCanvasMutation(
  mutationStore: MutationStore,
  mutation: CanvasMutation,
  fetchImplInner: typeof fetch,
) {
  const sessionId = mutationStore.getSessionId();
  if (!sessionId) {
    return;
  }

  const previousUserState = mutationStore.getUserState();
  mutationStore.replaceUserState(applyCanvasMutationLocally(previousUserState, mutation));
  mutationStore.setMutationError(null);

  const body = postCanvasRequestSchema.parse({ mutation });
  const response = await postWithRetry(apiUrl(sessionCanvasPath(sessionId)), body, fetchImplInner);

  if (response.status === 409 && BLOCKED_ON_CONFLICT.includes(mutation.type)) {
    mutationStore.replaceUserState(previousUserState);
    mutationStore.setMutationError(mutationErrors.blockedDuringRun());
    return;
  }

  if (!response.ok) {
    mutationStore.replaceUserState(previousUserState);
    mutationStore.setMutationError(mutationErrors.canvasFailed(response.status));
  }
}

export function createMutationController(
  store: MutationStore,
  fetchImpl: typeof fetch = fetch,
): MutationController {
  const selectionDebouncer = createDebouncer(300);
  const viewportDebouncer = createDebouncer(300);
  const positionFlusher = createCoalescingFlusher<
    Extract<CanvasMutation, { type: "setPositionOverride" }>["position"]
  >(100, (entries) => {
    for (const [nodeId, position] of entries) {
      void postCanvasMutation(store, { type: "setPositionOverride", nodeId, position }, fetchImpl);
    }
  });

  let pendingSelection: string[] | null = null;
  let pendingViewport: Extract<CanvasMutation, { type: "setViewport" }> | null = null;

  return {
    async sendMessage(text: string) {
      const sessionId = store.getSessionId();
      if (!sessionId) {
        return;
      }

      const message: ChatMessage = {
        kind: "user",
        id: crypto.randomUUID(),
        text,
      };

      store.appendChatMessage(message);
      store.setMutationError(null);

      const body = postMessageRequestSchema.parse({ text, messageId: message.id });
      const response = await postWithRetry(apiUrl(sessionMessagesPath(sessionId)), body, fetchImpl);

      if (response.status === 409) {
        store.removeChatMessage(message.id);
        store.setMutationError(mutationErrors.messageBlockedDuringRun());
        return;
      }

      if (!response.ok) {
        store.removeChatMessage(message.id);
        store.setMutationError(mutationErrors.messageFailed(response.status));
      }
    },

    upsertUserShape(shape) {
      void postCanvasMutation(store, { type: "upsertUserShape", shape }, fetchImpl);
    },

    deleteUserShape(shapeId) {
      void postCanvasMutation(store, { type: "deleteUserShape", shapeId }, fetchImpl);
    },

    addComment(comment) {
      void postCanvasMutation(store, { type: "addComment", comment }, fetchImpl);
    },

    setPositionOverride(nodeId, position) {
      positionFlusher.push(nodeId, position);
    },

    clearPositionOverrides() {
      void postCanvasMutation(store, { type: "clearPositionOverrides" }, fetchImpl);
    },

    setSelection(nodeIds) {
      pendingSelection = nodeIds;
      selectionDebouncer.schedule(() => {
        if (pendingSelection === null) {
          return;
        }
        const nextSelection = pendingSelection;
        pendingSelection = null;
        void postCanvasMutation(store, { type: "setSelection", nodeIds: nextSelection }, fetchImpl);
      });
    },

    setViewport(mutation) {
      pendingViewport = mutation;
      viewportDebouncer.schedule(() => {
        if (pendingViewport === null) {
          return;
        }
        const nextViewport = pendingViewport;
        pendingViewport = null;
        void postCanvasMutation(store, nextViewport, fetchImpl);
      });
    },

    async cancelRun() {
      const sessionId = store.getSessionId();
      if (!sessionId) {
        return;
      }

      store.setMutationError(null);
      const response = await postWithRetry(apiUrl(sessionCancelRunPath(sessionId)), {}, fetchImpl);
      if (!response.ok) {
        store.setMutationError(mutationErrors.cancelFailed(response.status));
      }
    },

    dispose() {
      selectionDebouncer.cancel();
      viewportDebouncer.cancel();
      positionFlusher.cancel();
    },
  };
}

export { applyCanvasMutationLocally, postWithRetry, BLOCKED_ON_CONFLICT };

export function submitClearPositionOverrides(
  store: MutationStore,
  fetchImpl: typeof fetch = fetch,
): void {
  void postCanvasMutation(store, { type: "clearPositionOverrides" }, fetchImpl);
}
