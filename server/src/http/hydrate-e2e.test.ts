import {
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionMessagesPath,
  sessionStatePath,
  type CanvasMutation,
  type SessionStateResponse,
} from "@pd-fade/shared";
import type { ChatMessage } from "@pd-fade/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { waitForRunningToolCall, waitForRunToFinish } from "../test-helpers.js";
import { applyCanvasMutationLocally } from "../../../client/src/lib/mutations.js";
import { foldEvents } from "../../../client/src/store/reducer.js";
import { createInitialReducerState } from "../../../client/src/store/reducer.js";
import { hydrateFromSessionResponse } from "../../../client/src/store/reducer.js";
import type { ReducerState } from "../../../client/src/store/reducer.js";

function pickComparableReloadState(state: ReducerState, lastSeq: number) {
  return {
    agentState: state.agentState,
    userState: state.userState,
    chat: state.chat,
    uiState: {
      runStatus: state.uiState.runStatus,
      currentRunId: state.uiState.currentRunId,
      runErrorMessage: state.uiState.runErrorMessage,
      cameraCommand: state.uiState.cameraCommand,
    },
    lastSeq,
  };
}

async function postCanvasMutation(
  app: Awaited<ReturnType<typeof buildServer>>,
  sessionId: string,
  mutation: CanvasMutation,
) {
  const response = await app.inject({
    method: "POST",
    url: sessionCanvasPath(sessionId),
    payload: { mutation },
  });
  expect(response.statusCode).toBe(200);
}

function buildLiveFoldState(body: SessionStateResponse): ReducerState {
  const folded = foldEvents(
    {
      ...createInitialReducerState(),
      agentState: body.snapshot,
      userState: body.userState,
      chat: [],
      uiState: createInitialReducerState().uiState,
    },
    body.tailEvents,
  );

  return {
    ...folded,
    chat: body.chat,
  };
}

describe("hydrate chat duplication E2E", () => {
  afterEach(() => {
    delete process.env.MOCK_DRIVER_POST_TOOL_START_DELAY_MS;
  });

  it("does not duplicate chat when hydrating session state after a mock run", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "hydrate-e2e-session";

    const messageResponse = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "show berlin entities", messageId: "user-msg-1" },
    });
    expect(messageResponse.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });
    expect(stateResponse.statusCode).toBe(200);

    const body = stateResponse.json();
    const authoritativeChat = body.chat as typeof body.chat;
    expect(authoritativeChat.length).toBeGreaterThan(0);

    const foldedWithChat = foldEvents(
      {
        ...createInitialReducerState(),
        agentState: body.snapshot,
        userState: body.userState,
        chat: authoritativeChat,
        uiState: createInitialReducerState().uiState,
      },
      body.tailEvents,
    );

    const hydrated = hydrateFromSessionResponse(body);

    const authoritativeSummary = authoritativeChat.find(
      (message: { kind: string; id?: string }) =>
        message.kind === "assistant" && message.id?.includes("assistant-summary"),
    );
    const foldedSummary = foldedWithChat.chat.find(
      (message) => message.kind === "assistant" && message.id?.includes("assistant-summary"),
    );

    expect(authoritativeSummary).toBeDefined();
    expect(foldedSummary?.kind).toBe("assistant");
    if (foldedSummary?.kind === "assistant" && authoritativeSummary?.kind === "assistant") {
      expect(foldedSummary.text.length).toBeGreaterThan(authoritativeSummary.text.length);
    }

    expect(hydrated.chat).toEqual(authoritativeChat);
    expect(hydrated.agentState.graph.nodes.length).toBeGreaterThan(0);

    await app.close();
  }, 20_000);

  it("hydrates cancelled in-flight tool cards consistently with live tail fold", async () => {
    process.env.MOCK_DRIVER_POST_TOOL_START_DELAY_MS = "500";

    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "hydrate-cancel-session";

    const messageResponse = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "cancel mid tool", messageId: "user-cancel-1" },
    });
    expect(messageResponse.statusCode).toBe(200);

    await waitForRunningToolCall(app, sessionId);

    const cancelResponse = await app.inject({
      method: "POST",
      url: sessionCancelRunPath(sessionId),
    });
    expect(cancelResponse.statusCode).toBe(200);

    await waitForRunToFinish(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });
    expect(stateResponse.statusCode).toBe(200);

    const body = stateResponse.json();
    const authoritativeChat = body.chat as ChatMessage[];
    const cancelledTools = authoritativeChat.filter(
      (message): message is Extract<ChatMessage, { kind: "toolCall" }> =>
        message.kind === "toolCall" && message.status === "cancelled",
    );

    expect(body.tailEvents.some((event: { type: string }) => event.type === "RUN_CANCELLED")).toBe(
      true,
    );
    expect(cancelledTools.length).toBeGreaterThan(0);

    const liveFold = foldEvents(
      {
        ...createInitialReducerState(),
        agentState: body.snapshot,
        userState: body.userState,
        chat: [],
        uiState: createInitialReducerState().uiState,
      },
      body.tailEvents,
    );

    const hydrated = hydrateFromSessionResponse(body);

    expect(hydrated.chat).toEqual(authoritativeChat);
    expect(hydrated.uiState.runStatus).toBe("cancelled");
    expect(liveFold.uiState.runStatus).toBe("cancelled");

    for (const serverTool of cancelledTools) {
      const foldedTool = liveFold.chat.find(
        (message) => message.kind === "toolCall" && message.toolCallId === serverTool.toolCallId,
      );
      expect(foldedTool).toMatchObject({ kind: "toolCall", status: "cancelled" });
    }

    await app.close();
  }, 20_000);
});

describe("full-fidelity session reload E2E", () => {
  afterEach(() => {
    delete process.env.MOCK_DRIVER_POST_TOOL_START_DELAY_MS;
  });

  it("reload lands exactly where the live session left off across all slices", async () => {
    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "reload-fidelity-session";

    const messageResponse = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "show berlin entities", messageId: "reload-user-1" },
    });
    expect(messageResponse.statusCode).toBe(200);
    await waitForRunToFinish(app, sessionId);

    const mutations: CanvasMutation[] = [
      {
        type: "upsertUserShape",
        shape: {
          id: "user-shape-reload",
          kind: "point",
          coordinates: [13.39, 52.51],
          label: "User pin",
        },
      },
      {
        type: "addComment",
        comment: {
          id: "comment-reload",
          targetShapeId: "shape-mitte",
          text: "Interesting district",
        },
      },
      {
        type: "setPositionOverride",
        nodeId: "company-techberlin",
        position: { x: 140, y: 220 },
      },
      {
        type: "setSelection",
        nodeIds: ["person-anna", "company-techberlin"],
      },
      {
        type: "setViewport",
        target: "graph",
        camera: { x: 12, y: 18, zoom: 1.25 },
      },
      {
        type: "setViewport",
        target: "map",
        camera: { center: [13.4, 52.52], zoom: 11.5, bearing: 0, pitch: 0 },
      },
    ];

    let liveState = hydrateFromSessionResponse(
      (await app.inject({ method: "GET", url: sessionStatePath(sessionId) })).json(),
    );

    for (const mutation of mutations) {
      await postCanvasMutation(app, sessionId, mutation);
      liveState = {
        ...liveState,
        userState: applyCanvasMutationLocally(liveState.userState, mutation),
      };
    }

    const beforeReloadResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });
    expect(beforeReloadResponse.statusCode).toBe(200);

    const beforeReloadBody = beforeReloadResponse.json() as SessionStateResponse;
    liveState = {
      ...buildLiveFoldState(beforeReloadBody),
      userState: beforeReloadBody.userState,
    };

    const reloaded = hydrateFromSessionResponse(beforeReloadBody);

    expect(pickComparableReloadState(reloaded, beforeReloadBody.lastSeq)).toEqual(
      pickComparableReloadState(liveState, beforeReloadBody.lastSeq),
    );

    await app.close();
  }, 20_000);

  it("hydrates an active run with running UI and materialized partial chat", async () => {
    process.env.MOCK_DRIVER_POST_TOOL_START_DELAY_MS = "500";

    const app = await buildServer({ dbPath: ":memory:" });
    const sessionId = "reload-midrun-session";

    const messageResponse = await app.inject({
      method: "POST",
      url: sessionMessagesPath(sessionId),
      payload: { text: "show berlin entities", messageId: "midrun-user-1" },
    });
    expect(messageResponse.statusCode).toBe(200);

    await waitForRunningToolCall(app, sessionId);

    const stateResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });
    expect(stateResponse.statusCode).toBe(200);

    const body = stateResponse.json() as SessionStateResponse;
    const hydrated = hydrateFromSessionResponse(body);
    const liveFold = buildLiveFoldState(body);

    expect(hydrated.uiState.runStatus).toBe("running");
    expect(liveFold.uiState.runStatus).toBe("running");
    expect(hydrated.uiState.currentRunId).toBeTruthy();
    expect(
      hydrated.chat.some(
        (message) =>
          message.kind === "toolCall" &&
          (message.status === "running" || message.status === "pending"),
      ),
    ).toBe(true);
    expect(hydrated.chat.some((message) => message.kind === "assistant")).toBe(true);
    expect(pickComparableReloadState(hydrated, body.lastSeq)).toEqual(
      pickComparableReloadState(liveFold, body.lastSeq),
    );

    await app.close();
  }, 20_000);
});
