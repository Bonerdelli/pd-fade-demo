import type {
  DirectCaller,
  Message,
  MessageDeltaUsage,
  MessageStreamEvent,
  RawContentBlockStartEvent,
  RawContentBlockStopEvent,
  RawMessageDeltaEvent,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

export const directToolCaller = { type: "direct" } satisfies DirectCaller;

const defaultUsage = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens_details: null,
  server_tool_use: null,
} satisfies MessageDeltaUsage;

const defaultMessageUsage = {
  input_tokens: 10,
  output_tokens: 10,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation: null,
  inference_geo: null,
  output_tokens_details: null,
  server_tool_use: null,
  service_tier: "standard",
} satisfies Message["usage"];

export function textContentBlock(text = ""): TextBlock {
  return { type: "text", text, citations: null };
}

export function toolUseContentBlock(id: string, name: string, input: unknown = {}): ToolUseBlock {
  return {
    type: "tool_use",
    id,
    name,
    input,
    caller: directToolCaller,
  };
}

export function contentBlockStart(
  index: number,
  contentBlock: RawContentBlockStartEvent["content_block"],
): RawContentBlockStartEvent {
  return {
    type: "content_block_start",
    index,
    content_block: contentBlock,
  };
}

export function contentBlockStop(index: number): RawContentBlockStopEvent {
  return { type: "content_block_stop", index };
}

export function textDeltaEvent(index: number, text: string): MessageStreamEvent {
  return {
    type: "content_block_delta",
    index,
    delta: { type: "text_delta", text },
  };
}

export function inputJsonDeltaEvent(index: number, partialJson: string): MessageStreamEvent {
  return {
    type: "content_block_delta",
    index,
    delta: { type: "input_json_delta", partial_json: partialJson },
  };
}

export function messageDeltaEvent(stopReason: Message["stop_reason"]): RawMessageDeltaEvent {
  return {
    type: "message_delta",
    delta: {
      stop_reason: stopReason,
      stop_sequence: null,
      container: null,
      stop_details: null,
    },
    usage: defaultUsage,
  };
}

export function buildAssistantMessage(
  content: Message["content"],
  stopReason: Message["stop_reason"],
): Message {
  return {
    id: "msg_fixture",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    container: null,
    stop_details: null,
    usage: defaultMessageUsage,
  };
}

export function searchEntitiesToolStreamEvents(
  toolCallId: string,
  queryJson: string,
): MessageStreamEvent[] {
  return [
    contentBlockStart(0, textContentBlock()),
    textDeltaEvent(0, "Searching"),
    contentBlockStop(0),
    contentBlockStart(1, toolUseContentBlock(toolCallId, "search_entities")),
    inputJsonDeltaEvent(1, queryJson),
    contentBlockStop(1),
    messageDeltaEvent("tool_use"),
  ];
}

export function endTurnTextStreamEvents(text: string): MessageStreamEvent[] {
  return [
    contentBlockStart(0, textContentBlock()),
    textDeltaEvent(0, text),
    contentBlockStop(0),
    messageDeltaEvent("end_turn"),
  ];
}

export function plotSignalsErrorStreamEvents(toolCallId: string): MessageStreamEvent[] {
  return [
    contentBlockStart(0, toolUseContentBlock(toolCallId, "plot_signals")),
    inputJsonDeltaEvent(0, '{"signalIds":["nonexistent-signal"]}'),
    contentBlockStop(0),
    messageDeltaEvent("tool_use"),
  ];
}

export function focusToolStreamEvents(toolCallId: string): MessageStreamEvent[] {
  return [
    contentBlockStart(0, toolUseContentBlock(toolCallId, "focus")),
    inputJsonDeltaEvent(0, '{"target":"map"}'),
    contentBlockStop(0),
    messageDeltaEvent("tool_use"),
  ];
}
