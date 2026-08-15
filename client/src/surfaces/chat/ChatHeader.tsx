import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";
import { ConnectionStatusPill } from "./ConnectionStatusPill.js";

export function ChatHeader() {
  const { t } = useTranslation("chat");
  const connectionStatus = useAppStore((state) => state.uiState.connectionStatus);
  const startNewSession = useAppStore((state) => state.startNewSession);

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3">
      <h2 className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("panelTitle")}
      </h2>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          onClick={() => startNewSession?.()}
        >
          {t("newChat")}
        </button>
        <ConnectionStatusPill status={connectionStatus} />
      </div>
    </header>
  );
}
