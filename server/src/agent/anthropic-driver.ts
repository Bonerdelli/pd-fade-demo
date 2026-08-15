import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { AnthropicStreamTranslator, type CompletedToolUse } from "./anthropic-translator.js";
import { buildSystemPrompt } from "./context-slice.js";
import { RunCancelledError, type AgentDriver, type AgentRunContext, type EmitFn } from "./driver.js";
import { anthropicToolDefinitions } from "./tool-schemas.js";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
}

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when AGENT_DRIVER=anthropic");
  }

  return new Anthropic({ apiKey });
}

function buildToolResultBlocks(completed: CompletedToolUse[]): ToolResultBlockParam[] {
  return completed.map((entry) => ({
    type: "tool_result",
    tool_use_id: entry.toolUseId,
    content: JSON.stringify(entry.result),
    is_error: entry.status === "error",
  }));
}

export class AnthropicAgentDriver implements AgentDriver {
  constructor(private readonly client: Anthropic = createAnthropicClient()) {}

  async run(context: AgentRunContext, emit: EmitFn): Promise<void> {
    const { runId, userMessage, userState, signal } = context;
    let agentState = context.agentState;

    await emit({ type: "RUN_STARTED", runId });

    const messages: MessageParam[] = [{ role: "user", content: userMessage }];
    const system = buildSystemPrompt(agentState, userState);
    let turnIndex = 0;

    while (true) {
      if (signal.aborted) {
        throw new RunCancelledError();
      }

      const translator = new AnthropicStreamTranslator(
        runId,
        emit,
        signal,
        () => agentState,
        (nextState) => {
          agentState = nextState;
        },
        turnIndex,
      );

      const stream = this.client.messages.stream({
        model: resolveAnthropicModel(),
        max_tokens: 4096,
        system,
        tools: anthropicToolDefinitions as Tool[],
        messages,
      });

      try {
        for await (const event of stream) {
          if (signal.aborted) {
            stream.abort();
            throw new RunCancelledError();
          }

          await translator.handleStreamEvent(event);
        }
      } catch (error) {
        if (signal.aborted) {
          throw new RunCancelledError();
        }
        throw error;
      }

      const stopReason = translator.getStopReason() ?? (await stream.finalMessage()).stop_reason;

      if (stopReason !== "tool_use") {
        break;
      }

      const finalMessage = await stream.finalMessage();
      const completedTools = translator.getCompletedToolUses();

      messages.push({ role: "assistant", content: finalMessage.content });
      messages.push({
        role: "user",
        content: buildToolResultBlocks(completedTools),
      });

      turnIndex += 1;
    }

    await emit({ type: "RUN_FINISHED", runId });
  }
}
