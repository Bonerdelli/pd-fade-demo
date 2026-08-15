import type { ChatMessage } from "@pd-fade/shared";

export function resolveLatestToolCallId(messages: ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.kind === "toolCall") {
      return message.toolCallId;
    }
  }
  return null;
}

export function shouldExpandByDefault(toolCallId: string, latestToolCallId: string | null): boolean {
  return toolCallId === latestToolCallId;
}
