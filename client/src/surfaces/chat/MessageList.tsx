import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";
import { useScrollPin } from "./hooks/use-scroll-pin.js";
import { useToolCardExpandedState } from "./hooks/use-tool-card-expanded.js";
import { MessageItem } from "./MessageItem.js";

export function MessageList() {
  const { t } = useTranslation("chat");
  const chat = useAppStore((state) => state.chat);
  const { containerRef, handleScroll } = useScrollPin(chat);
  const { isExpanded, toggleExpanded } = useToolCardExpandedState(chat);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      aria-label={t("messageList.label")}
    >
      {chat.length === 0 ? (
        <p className="text-center text-sm text-slate-500">{t("messageList.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {chat.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isToolExpanded={isExpanded}
              onToggleTool={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
