import type { ChatMessage } from "@pd-fade/shared";
import type { RunStatus } from "../../../store/types.js";

export function shouldShowThinkingIndicator(runStatus: RunStatus, chat: ChatMessage[]): boolean {
  if (runStatus !== "running") {
    return false;
  }

  let lastUserIndex = -1;
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    if (chat[index]?.kind === "user") {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex === -1) {
    return true;
  }

  for (let index = lastUserIndex + 1; index < chat.length; index += 1) {
    const message = chat[index];
    if (message?.kind === "assistant" || message?.kind === "toolCall") {
      return false;
    }
  }

  return true;
}
