import type { MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import type { AgentState } from "@pd-fade/shared";
import { RunCancelledError, type EmitFn } from "./driver.js";
import { executeTool } from "./tool-executors.js";

interface ActiveToolBlock {
  toolCallId: string;
  name: string;
  argsJson: string;
}

export interface CompletedToolUse {
  toolUseId: string;
  name: string;
  input: unknown;
  status: "ok" | "error";
  result: unknown;
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new RunCancelledError();
  }
}

export class AnthropicStreamTranslator {
  private readonly activeTools = new Map<number, ActiveToolBlock>();
  private readonly activeTextMessageIds = new Map<number, string>();
  private textBlockCount = 0;
  private stopReason: string | null = null;
  private readonly completedToolUses: CompletedToolUse[] = [];

  constructor(
    private readonly runId: string,
    private readonly emit: EmitFn,
    private readonly signal: AbortSignal,
    private readonly getAgentState: () => AgentState,
    private readonly setAgentState: (state: AgentState) => void,
    private readonly turnIndex: number,
  ) {}

  getStopReason(): string | null {
    return this.stopReason;
  }

  getCompletedToolUses(): CompletedToolUse[] {
    return [...this.completedToolUses];
  }

  async handleStreamEvent(event: MessageStreamEvent): Promise<void> {
    checkAbort(this.signal);

    switch (event.type) {
      case "content_block_start":
        await this.handleContentBlockStart(event);
        break;
      case "content_block_delta":
        await this.handleContentBlockDelta(event);
        break;
      case "content_block_stop":
        await this.handleContentBlockStop(event.index);
        break;
      case "message_delta":
        this.stopReason = event.delta.stop_reason ?? this.stopReason;
        break;
      default:
        break;
    }
  }

  private messageIdForTextBlock(): string {
    this.textBlockCount += 1;
    if (this.turnIndex === 0 && this.textBlockCount === 1) {
      return `${this.runId}-assistant`;
    }

    return `${this.runId}-assistant-${this.turnIndex}-${this.textBlockCount}`;
  }

  private async handleContentBlockStart(
    event: Extract<MessageStreamEvent, { type: "content_block_start" }>,
  ): Promise<void> {
    const block = event.content_block;

    if (block.type === "text") {
      this.activeTextMessageIds.set(event.index, this.messageIdForTextBlock());
      return;
    }

    if (block.type === "tool_use") {
      this.activeTools.set(event.index, {
        toolCallId: block.id,
        name: block.name,
        argsJson: "",
      });

      await this.emit({
        type: "TOOL_START",
        runId: this.runId,
        toolCallId: block.id,
        name: block.name,
      });
    }
  }

  private async handleContentBlockDelta(
    event: Extract<MessageStreamEvent, { type: "content_block_delta" }>,
  ): Promise<void> {
    const delta = event.delta;

    if (delta.type === "text_delta") {
      const messageId = this.activeTextMessageIds.get(event.index);
      if (!messageId || delta.text.length === 0) {
        return;
      }

      await this.emit({
        type: "TEXT_DELTA",
        runId: this.runId,
        messageId,
        delta: delta.text,
      });
      return;
    }

    if (delta.type === "input_json_delta") {
      const activeTool = this.activeTools.get(event.index);
      if (!activeTool || delta.partial_json.length === 0) {
        return;
      }

      activeTool.argsJson += delta.partial_json;
      await this.emit({
        type: "TOOL_ARGS",
        runId: this.runId,
        toolCallId: activeTool.toolCallId,
        delta: delta.partial_json,
      });
    }
  }

  private async handleContentBlockStop(index: number): Promise<void> {
    const activeTool = this.activeTools.get(index);
    if (!activeTool) {
      this.activeTextMessageIds.delete(index);
      return;
    }

    this.activeTools.delete(index);

    let parsedInput: unknown;
    try {
      parsedInput = activeTool.argsJson.length > 0 ? JSON.parse(activeTool.argsJson) : {};
    } catch {
      const message = "Tool arguments were not valid JSON";
      await this.emit({
        type: "TOOL_RESULT",
        runId: this.runId,
        toolCallId: activeTool.toolCallId,
        status: "error",
        result: { message },
      });

      this.completedToolUses.push({
        toolUseId: activeTool.toolCallId,
        name: activeTool.name,
        input: {},
        status: "error",
        result: { message },
      });
      return;
    }

    const outcome = executeTool(activeTool.name, parsedInput, this.getAgentState());

    await this.emit({
      type: "TOOL_RESULT",
      runId: this.runId,
      toolCallId: activeTool.toolCallId,
      status: outcome.status,
      result: outcome.result,
    });

    if (outcome.agentState) {
      this.setAgentState(outcome.agentState);
      await this.emit({
        type: "STATE_SNAPSHOT",
        runId: this.runId,
        snapshot: outcome.agentState,
      });
    }

    if (outcome.viewportCommand) {
      await this.emit({
        type: "VIEWPORT_COMMAND",
        runId: this.runId,
        target: outcome.viewportCommand.target,
        camera: outcome.viewportCommand.camera,
      });
    }

    this.completedToolUses.push({
      toolUseId: activeTool.toolCallId,
      name: activeTool.name,
      input: parsedInput,
      status: outcome.status,
      result: outcome.result,
    });
  }
}
