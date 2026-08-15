import type { AgentState, UserState } from "@pd-fade/shared";

export const emptyAgentState: AgentState = {
  graph: { nodes: [], edges: [], layout: {} },
  map: { shapes: [], signals: [] },
};

export const emptyUserState: UserState = {
  map: { shapes: [] },
  comments: [],
  positionOverrides: {},
  selection: [],
  viewports: { graph: null, map: null },
};
