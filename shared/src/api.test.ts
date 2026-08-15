import { describe, it } from "vitest";
import {
  addCommentMutationSchema,
  canvasMutationSchema,
  deleteUserShapeMutationSchema,
  postCanvasRequestSchema,
  postMessageRequestSchema,
  sessionStateResponseSchema,
  setPositionOverrideMutationSchema,
  clearPositionOverridesMutationSchema,
  setSelectionMutationSchema,
  setViewportMutationSchema,
  upsertUserShapeMutationSchema,
} from "./api.js";
import { emptyAgentState, envelope, expectInvalid, expectValid } from "./test-helpers.js";

describe("REST and canvas mutation schemas", () => {
  it("validates post message request", () => {
    expectValid(postMessageRequestSchema, { text: "hello" });
    expectValid(postMessageRequestSchema, { text: "hello", messageId: "msg-1" });
    expectInvalid(postMessageRequestSchema, { text: "" });
    expectInvalid(postMessageRequestSchema, { text: 123 });
  });

  it("validates upsertUserShape mutation", () => {
    expectValid(upsertUserShapeMutationSchema, {
      type: "upsertUserShape",
      shape: { id: "s1", kind: "point", coordinates: [1, 2] },
    });
    expectInvalid(upsertUserShapeMutationSchema, {
      type: "deleteUserShape",
      shape: { id: "s1", kind: "point", coordinates: [1, 2] },
    });
    expectInvalid(upsertUserShapeMutationSchema, {
      type: "upsertUserShape",
      shape: { id: "s1", kind: "point" },
    });
  });

  it("validates deleteUserShape mutation", () => {
    expectValid(deleteUserShapeMutationSchema, { type: "deleteUserShape", shapeId: "s1" });
    expectInvalid(deleteUserShapeMutationSchema, { type: "deleteUserShape" });
    expectInvalid(deleteUserShapeMutationSchema, { type: "deleteUserShape", shapeId: 1 });
  });

  it("validates addComment mutation", () => {
    expectValid(addCommentMutationSchema, {
      type: "addComment",
      comment: { id: "c1", targetShapeId: "s1", text: "note" },
    });
    expectInvalid(addCommentMutationSchema, {
      type: "addComment",
      comment: { id: "c1", targetShapeId: "s1" },
    });
    expectInvalid(addCommentMutationSchema, {
      type: "addComment",
      comment: { id: "c1", targetShapeId: "s1", text: 1 },
    });
  });

  it("validates setPositionOverride mutation", () => {
    expectValid(setPositionOverrideMutationSchema, {
      type: "setPositionOverride",
      nodeId: "n1",
      position: { x: 1, y: 2 },
    });
    expectValid(setPositionOverrideMutationSchema, {
      type: "setPositionOverride",
      nodeId: "n1",
      position: null,
    });
    expectInvalid(setPositionOverrideMutationSchema, {
      type: "setPositionOverride",
      nodeId: "n1",
    });
    expectInvalid(setPositionOverrideMutationSchema, {
      type: "setPositionOverride",
      nodeId: "n1",
      position: { x: "1", y: 2 },
    });
  });

  it("validates setSelection mutation", () => {
    expectValid(setSelectionMutationSchema, { type: "setSelection", nodeIds: ["n1", "n2"] });
    expectInvalid(setSelectionMutationSchema, { type: "setSelection", nodeIds: "n1" });
    expectInvalid(setSelectionMutationSchema, { type: "setSelection", nodeIds: [1] });
  });

  it("validates clearPositionOverrides mutation", () => {
    expectValid(clearPositionOverridesMutationSchema, { type: "clearPositionOverrides" });
    expectInvalid(clearPositionOverridesMutationSchema, { type: "setSelection", nodeIds: [] });
    expectInvalid(clearPositionOverridesMutationSchema, { type: "clearPositionOverride" });
  });

  it("validates setViewport mutation", () => {
    expectValid(setViewportMutationSchema, {
      type: "setViewport",
      target: "graph",
      camera: { x: 0, y: 0, zoom: 1 },
    });
    expectValid(setViewportMutationSchema, {
      type: "setViewport",
      target: "map",
      camera: null,
    });
    expectInvalid(setViewportMutationSchema, {
      type: "setViewport",
      target: "graph",
      camera: { center: [0, 0], zoom: 1 },
    });
    expectInvalid(setViewportMutationSchema, {
      type: "setViewport",
      target: "sidebar",
      camera: null,
    });
  });

  it("validates canvas mutation union", () => {
    expectValid(canvasMutationSchema, {
      type: "setSelection",
      nodeIds: [],
    });
    expectValid(canvasMutationSchema, {
      type: "clearPositionOverrides",
    });
    expectInvalid(canvasMutationSchema, { type: "unknownMutation" });
    expectInvalid(canvasMutationSchema, { type: "setSelection" });
  });

  it("validates post canvas request wrapper", () => {
    expectValid(postCanvasRequestSchema, {
      mutation: { type: "setSelection", nodeIds: [] },
    });
    expectInvalid(postCanvasRequestSchema, { mutation: { type: "setSelection" } });
    expectInvalid(postCanvasRequestSchema, { mutation: "setSelection" });
  });

  it("validates session state response", () => {
    expectValid(sessionStateResponseSchema, {
      snapshot: emptyAgentState,
      userState: {
        map: { shapes: [] },
        comments: [],
        positionOverrides: {},
        selection: [],
        viewports: { graph: null, map: null },
      },
      chat: [{ kind: "user", id: "m1", text: "hi" }],
      tailEvents: [{ ...envelope, type: "RUN_STARTED" }],
      lastSeq: 0,
    });
    expectInvalid(sessionStateResponseSchema, {
      snapshot: emptyAgentState,
      userState: {},
      chat: [],
      tailEvents: [],
      lastSeq: 0,
    });
    expectInvalid(sessionStateResponseSchema, {
      snapshot: emptyAgentState,
      userState: {
        map: { shapes: [] },
        comments: [],
        positionOverrides: {},
        selection: [],
        viewports: { graph: null, map: null },
      },
      chat: [],
      tailEvents: [],
      lastSeq: -1,
    });
  });
});
