import {
  sessionCancelRunPath,
  sessionCanvasPath,
  sessionEventsPath,
  sessionMessagesPath,
  sessionStatePath,
  agentEventSchema,
  type AgentEvent,
  type CanvasMutation,
  type ChatMessage,
  type SessionStateResponse,
} from "@pd-fade/shared";
import { get } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { waitForRunningToolCall, waitForRunToFinish } from "../test-helpers.js";
import { parseSseChunk } from "../../../client/src/lib/sse.js";
import { applyCanvasMutationLocally } from "../../../client/src/lib/mutations.js";
import { foldEvents } from "../../../client/src/store/reducer.js";
import { createInitialReducerState } from "../../../client/src/store/reducer.js";
import { hydrateFromSessionResponse } from "../../../client/src/store/reducer.js";
import { reduceEvent } from "../../../client/src/store/reducer.js";
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
      runErrorReasonCode: state.uiState.runErrorReasonCode,
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

function assertSessionStateResponseShape(body: SessionStateResponse): void {
  expect(body.snapshot.graph.nodes).toBeInstanceOf(Array);
  expect(body.snapshot.graph.edges).toBeInstanceOf(Array);
  expect(body.snapshot.graph.layout).toBeDefined();
  expect(body.snapshot.map.shapes).toBeInstanceOf(Array);
  expect(body.snapshot.map.signals).toBeInstanceOf(Array);

  expect(body.userState.map.shapes).toBeInstanceOf(Array);
  expect(body.userState.comments).toBeInstanceOf(Array);
  expect(body.userState.positionOverrides).toBeDefined();
  expect(body.userState.selection).toBeInstanceOf(Array);
  expect(Object.hasOwn(body.userState.viewports, "graph")).toBe(true);
  expect(Object.hasOwn(body.userState.viewports, "map")).toBe(true);

  expect(body.chat).toBeInstanceOf(Array);
  expect(body.chat.length).toBeGreaterThan(0);
  for (const message of body.chat) {
    expect(message).toHaveProperty("kind");
    expect(message).toHaveProperty("id");
    if (message.kind === "user" || message.kind === "assistant") {
      expect(message).toHaveProperty("text");
    }
    if (message.kind === "toolCall") {
      expect(message).toHaveProperty("toolCallId");
      expect(message).toHaveProperty("name");
      expect(message).toHaveProperty("status");
    }
  }

  expect(body.tailEvents).toBeInstanceOf(Array);
  expect(typeof body.lastSeq).toBe("number");
  expect(body.lastSeq).toBeGreaterThan(0);
}

function assertReloadMutationFields(body: SessionStateResponse): void {
  expect(body.userState.map.shapes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "user-shape-reload", kind: "point" }),
    ]),
  );
  expect(body.userState.comments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "comment-reload",
        targetShapeId: "shape-mitte",
        text: "Interesting district",
      }),
    ]),
  );
  expect(body.userState.positionOverrides["company-techberlin"]).toEqual({ x: 140, y: 220 });
  expect(body.userState.selection).toEqual(["person-anna", "company-techberlin"]);
  expect(body.userState.viewports.graph).toEqual({ x: 12, y: 18, zoom: 1.25 });
  expect(body.userState.viewports.map).toEqual({
    center: [13.4, 52.52],
    zoom: 11.5,
  });
}

function parseSsePayload(data: string): AgentEvent | null {
  try {
    const payload: unknown = JSON.parse(data);
    const validated = agentEventSchema.safeParse(payload);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

async function simulateLiveClientRun(
  baseUrl: string,
  sessionId: string,
  userMessage: { messageId: string; text: string },
): Promise<{ state: ReducerState; lastSeq: number }> {
  let state = createInitialReducerState();
  let lastSeq = 0;
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    const request = get(`${baseUrl}${sessionEventsPath(sessionId)}`, (response) => {
      response.on("data", (chunk: Buffer) => {
        const parsed = parseSseChunk(buffer + chunk.toString());
        buffer = parsed.remainder;

        for (const frame of parsed.events) {
          const event = parseSsePayload(frame.data);
          if (!event || event.seq <= lastSeq) {
            continue;
          }

          state = reduceEvent(state, event);
          lastSeq = event.seq;

          if (event.type === "RUN_FINISHED") {
            response.destroy();
            request.destroy();
            resolve();
          }
        }
      });

      response.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNRESET") {
          resolve();
          return;
        }
        reject(error);
      });
    });

    request.on("error", reject);

    setTimeout(() => {
      state = {
        ...state,
        chat: [
          ...state.chat,
          { kind: "user", id: userMessage.messageId, text: userMessage.text },
        ],
      };

      void fetch(`${baseUrl}${sessionMessagesPath(sessionId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMessage),
      });
    }, 50);

    setTimeout(() => reject(new Error("Live client SSE timeout")), 12_000);
  });

  return { state, lastSeq };
}

async function listenBaseUrl(app: Awaited<ReturnType<typeof buildServer>>): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected server address");
  }
  return `http://127.0.0.1:${address.port}`;
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
    const baseUrl = await listenBaseUrl(app);

    const { state: runState, lastSeq: runLastSeq } = await simulateLiveClientRun(
      baseUrl,
      sessionId,
      { messageId: "reload-user-1", text: "show berlin entities" },
    );

    expect(runState.agentState.graph.nodes.length).toBeGreaterThan(0);
    expect(runState.uiState.runStatus).toBe("idle");

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
        camera: { center: [13.4, 52.52], zoom: 11.5 },
      },
    ];

    let liveState = runState;
    const liveLastSeq = runLastSeq;

    for (const mutation of mutations) {
      await postCanvasMutation(app, sessionId, mutation);
      liveState = {
        ...liveState,
        userState: applyCanvasMutationLocally(liveState.userState, mutation),
      };
    }

    const reloadResponse = await app.inject({
      method: "GET",
      url: sessionStatePath(sessionId),
    });
    expect(reloadResponse.statusCode).toBe(200);

    const reloadBody = reloadResponse.json() as SessionStateResponse;
    assertSessionStateResponseShape(reloadBody);
    assertReloadMutationFields(reloadBody);

    const reloaded = hydrateFromSessionResponse(reloadBody);

    expect(reloadBody.lastSeq).toBe(liveLastSeq);
    expect(pickComparableReloadState(reloaded, reloadBody.lastSeq)).toEqual(
      pickComparableReloadState(liveState, liveLastSeq),
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

    const runningTool = hydrated.chat.find(
      (message): message is Extract<ChatMessage, { kind: "toolCall" }> =>
        message.kind === "toolCall" &&
        (message.status === "running" || message.status === "pending"),
    );
    expect(runningTool).toMatchObject({ kind: "toolCall", name: "search_entities" });

    const assistantDraft = hydrated.chat.find(
      (message): message is Extract<ChatMessage, { kind: "assistant" }> =>
        message.kind === "assistant" && message.id.includes("assistant"),
    );
    expect(assistantDraft?.text.length ?? 0).toBeGreaterThan(0);

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
