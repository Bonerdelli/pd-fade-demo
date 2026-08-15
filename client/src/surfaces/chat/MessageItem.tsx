import type { ChatMessage } from "@pd-fade/shared";
import { ToolCard } from "./ToolCard.js";

interface MessageItemProps {
  message: ChatMessage;
  isToolExpanded: (toolCallId: string) => boolean;
  onToggleTool: (toolCallId: string) => void;
}

export function MessageItem({ message, isToolExpanded, onToggleTool }: MessageItemProps) {
  if (message.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-3 py-2 text-sm text-white">
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    );
  }

  if (message.kind === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <ToolCard
      message={message}
      isExpanded={isToolExpanded(message.toolCallId)}
      onToggle={() => onToggleTool(message.toolCallId)}
    />
  );
}
