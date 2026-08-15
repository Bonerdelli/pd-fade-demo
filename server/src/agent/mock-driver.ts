import {
  delay,
  emitTextDeltas,
  emitToolCall,
  type AgentDriver,
  type AgentRunContext,
  type EmitFn,
} from "./driver.js";
import { BERLIN_CENTER } from "./dataset.js";
import { executeTool } from "./tool-executors.js";

export class MockAgentDriver implements AgentDriver {
  async run(context: AgentRunContext, emit: EmitFn): Promise<void> {
    const { runId, userMessage, signal } = context;
    let agentState = context.agentState;

    await emit({ type: "RUN_STARTED", runId });

    const intro =
      `I'll analyze your request about "${userMessage}" and explore the Berlin entity graph. ` +
      "Let me search the knowledge base first.";
    const assistantMessageId = `${runId}-assistant`;
    await emitTextDeltas(emit, runId, assistantMessageId, intro, signal);

    const searchArgs = {
      query: userMessage,
      kinds: ["company", "person", "location"],
      city: "Berlin",
    };
    const searchOutcome = executeTool("search_entities", searchArgs, agentState);

    await emitToolCall(
      emit,
      runId,
      `${runId}-tool-search`,
      "search_entities",
      searchArgs,
      searchOutcome.result,
      signal,
    );

    if (searchOutcome.agentState) {
      agentState = searchOutcome.agentState;
      await delay(50, signal);
      await emit({
        type: "STATE_SNAPSHOT",
        runId,
        snapshot: agentState,
      });
    }

    await delay(40, signal);
    await emit({
      type: "VIEWPORT_COMMAND",
      runId,
      target: "graph",
      camera: {
        x: -40,
        y: -20,
        zoom: 0.9,
      },
    });

    const mid =
      "Found eight related entities across companies, people and locations. " +
      "Plotting geo signals next.";
    await emitTextDeltas(emit, runId, `${runId}-assistant-mid`, mid, signal);

    const plotArgs = {
      signalIds: ["signal-1", "signal-2", "signal-3"],
      center: BERLIN_CENTER,
    };
    const plotOutcome = executeTool("plot_signals", plotArgs, agentState);

    await emitToolCall(
      emit,
      runId,
      `${runId}-tool-plot`,
      "plot_signals",
      plotArgs,
      plotOutcome.result,
      signal,
    );

    if (plotOutcome.agentState) {
      agentState = plotOutcome.agentState;
      await delay(50, signal);
      await emit({
        type: "STATE_SNAPSHOT",
        runId,
        snapshot: agentState,
      });
    }

    await delay(40, signal);
    await emit({
      type: "VIEWPORT_COMMAND",
      runId,
      target: "map",
      camera: {
        center: BERLIN_CENTER,
        zoom: 12.5,
      },
    });

    const summary =
      "Mapped three activity signals around central Berlin and linked eight entities in the graph. " +
      "TechBerlin GmbH and Spree Ventures anchor the company layer with people and district locations connected.";
    await emitTextDeltas(emit, runId, `${runId}-assistant-summary`, summary, signal);

    await emit({ type: "RUN_FINISHED", runId });
  }
}

export { createAgentDriver } from "./create-agent-driver.js";
