import { describe, expect, it, vi } from "vitest";
import type { UserState } from "@pd-fade/shared";
import { emptyUserState } from "../store/types.js";
import { applyCanvasMutationLocally, createMutationController } from "./mutations.js";

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
      expect(store.setMutationError).toHaveBeenCalledWith(
        "Mutation blocked while agent run is active",
      );
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
});

describe("applyCanvasMutationLocally", () => {
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
