import { sessionCancelRunPath, sessionMessagesPath, sessionStatePath } from "@pd-fade/shared";
import type { ChatMessage } from "@pd-fade/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { waitForRunningToolCall, waitForRunToFinish } from "../test-helpers.js";
import { foldEvents } from "../../../client/src/store/reducer.js";
import { createInitialReducerState } from "../../../client/src/store/reducer.js";
import { hydrateFromSessionResponse } from "../../../client/src/store/reducer.js";

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
