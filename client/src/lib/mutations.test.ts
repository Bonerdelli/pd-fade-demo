import { describe, expect, it, vi } from "vitest";
import type { UserState } from "@pd-fade/shared";
import { emptyUserState } from "../store/types.js";
import { applyCanvasMutationLocally, createMutationController } from "./mutations.js";
import { mutationErrors } from "./mutation-errors.js";

function createTestStore(initialUserState: UserState = emptyUserState) {
  const store = {
    userState: initialUserState,
    getSessionId: () => "session-1",
    getUserState: () => store.userState,
    replaceUserState: (next: UserState) => {
      store.userState = next;
    },
    appendChatMessage: vi.fn(),
    removeChatMessage: vi.fn(),
    setMutationError: vi.fn(),
  };

  return store;
}

describe("createMutationController", () => {
  it("rolls back optimistic canvas mutations on 409 conflict", async () => {
    const store = createTestStore();

    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 409,
    })) as unknown as typeof fetch;

    const controller = createMutationController(store, fetchImpl);

    controller.upsertUserShape({
      id: "shape-1",
      kind: "point",
      coordinates: [1, 2],
    });

    await vi.waitFor(() => {
      expect(store.setMutationError).toHaveBeenCalledWith(mutationErrors.blockedDuringRun());
    });

    expect(store.userState.map.shapes).toEqual([]);

    controller.dispose();
  });

  it("applies optimistic user state locally before posting", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const store = createTestStore();
    const fetchImpl = vi.fn(async () => fetchPromise) as unknown as typeof fetch;
    const controller = createMutationController(store, fetchImpl);

    controller.addComment({
      id: "comment-1",
      targetShapeId: "shape-1",
      text: "note",
    });

    expect(store.userState.comments).toEqual([
      { id: "comment-1", targetShapeId: "shape-1", text: "note" },
    ]);

    resolveFetch({ ok: true, status: 200 } as Response);
    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    controller.dispose();
  });

  it("applies selection locally immediately and debounces upstream POST", async () => {
    vi.useFakeTimers();

    const store = createTestStore();
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    const controller = createMutationController(store, fetchImpl);

    controller.setSelection(["node-1"]);
    expect(store.userState.selection).toEqual(["node-1"]);
    expect(fetchImpl).not.toHaveBeenCalled();

    controller.setSelection(["node-2"]);
    expect(store.userState.selection).toEqual(["node-2"]);
    expect(fetchImpl).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/canvas"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mutation: { type: "setSelection", nodeIds: ["node-2"] },
        }),
      }),
    );

    controller.dispose();
    vi.useRealTimers();
  });

  it("rolls back debounced selection when upstream POST fails", async () => {
    vi.useFakeTimers();

    const store = createTestStore();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400 } as Response));
    const controller = createMutationController(store, fetchImpl);

    controller.setSelection(["node-1"]);
    expect(store.userState.selection).toEqual(["node-1"]);

    await vi.advanceTimersByTimeAsync(300);
    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
    expect(store.userState.selection).toEqual([]);

    controller.dispose();
    vi.useRealTimers();
  });
});

describe("applyCanvasMutationLocally", () => {
  it("cascades comment deletion when deleting a user shape", () => {
    const withComment = applyCanvasMutationLocally(
      {
        ...emptyUserState,
        map: {
          shapes: [{ id: "s1", kind: "point", coordinates: [0, 0] }],
        },
        comments: [{ id: "c1", targetShapeId: "s1", text: "note" }],
      },
      { type: "deleteUserShape", shapeId: "s1" },
    );

    expect(withComment.map.shapes).toHaveLength(0);
    expect(withComment.comments).toHaveLength(0);
  });

  it("upserts and deletes user shapes", () => {
    const withShape = applyCanvasMutationLocally(emptyUserState, {
      type: "upsertUserShape",
      shape: { id: "s1", kind: "point", coordinates: [0, 0] },
    });
    expect(withShape.map.shapes).toHaveLength(1);

    const deleted = applyCanvasMutationLocally(withShape, {
      type: "deleteUserShape",
      shapeId: "s1",
    });
    expect(deleted.map.shapes).toHaveLength(0);
  });
});
