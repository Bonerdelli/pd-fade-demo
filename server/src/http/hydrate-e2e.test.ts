import { sessionMessagesPath, sessionStatePath } from "@pd-fade/shared";
import { describe, expect, it } from "vitest";
import { buildServer } from "../index.js";
import { waitForRunToFinish } from "../test-helpers.js";
import { foldEvents } from "../../../client/src/store/reducer.js";
import { createInitialReducerState } from "../../../client/src/store/reducer.js";
import { hydrateFromSessionResponse } from "../../../client/src/store/reducer.js";

describe("hydrate chat duplication E2E", () => {
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
});
