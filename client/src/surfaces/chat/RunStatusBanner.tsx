import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";
import { shouldShowThinkingIndicator } from "./lib/should-show-thinking.js";

export function RunStatusBanner() {
  const { t } = useTranslation("chat");
  const chat = useAppStore((state) => state.chat);
  const runStatus = useAppStore((state) => state.uiState.runStatus);
  const runErrorMessage = useAppStore((state) => state.uiState.runErrorMessage);

  const showThinking = shouldShowThinkingIndicator(runStatus, chat);
  const showError = runStatus === "error" && runErrorMessage !== null;
  const showCancelled = runStatus === "cancelled";
  const localizedError =
    runErrorMessage !== null
      ? t(`runStatus.errors.${runErrorMessage}`, { defaultValue: runErrorMessage })
      : null;

  if (!showThinking && !showError && !showCancelled) {
    return null;
  }

  return (
    <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-2">
      {showThinking ? (
        <div
          className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600"
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-400" />
          {t("runStatus.thinking")}
        </div>
      ) : null}
      {showError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          <p className="font-medium">{t("runStatus.errorTitle")}</p>
          <p className="mt-1">{localizedError}</p>
        </div>
      ) : null}
      {showCancelled ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t("runStatus.cancelled")}
        </div>
      ) : null}
    </div>
  );
}
