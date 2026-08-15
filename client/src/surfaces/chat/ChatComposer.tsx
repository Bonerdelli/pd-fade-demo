import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutations } from "../../hooks/use-mutations.js";
import { useRunLock } from "../../hooks/use-run-lock.js";

export function ChatComposer() {
  const { t } = useTranslation("chat");
  const isRunning = useRunLock();
  const { sendMessage, cancelRun } = useMutations();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, text]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isRunning || isSending) {
      return;
    }

    setIsSending(true);
    setText("");
    try {
      await sendMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [isRunning, isSending, sendMessage, text]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (!isRunning) {
        void handleSend();
      }
    },
    [handleSend, isRunning],
  );

  const handleStop = useCallback(() => {
    void cancelRun();
  }, [cancelRun]);

  const placeholder = isRunning ? t("composer.placeholderRunning") : t("composer.placeholder");
  const isSendDisabled = !text.trim() || isSending;

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="min-h-9 flex-1 resize-none overflow-hidden rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
          aria-label={t("composer.inputLabel")}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            title={t("composer.stopTooltip")}
          >
            {t("composer.stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSendDisabled}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
            title={t("composer.sendTooltip")}
          >
            {t("composer.send")}
          </button>
        )}
      </div>
    </div>
  );
}
