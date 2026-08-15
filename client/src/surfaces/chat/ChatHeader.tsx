import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";
import { ConnectionStatusPill } from "./ConnectionStatusPill.js";

export function ChatHeader() {
  const { t } = useTranslation("chat");
  const connectionStatus = useAppStore((state) => state.uiState.connectionStatus);
  const debugMode = useAppStore((state) => state.uiState.debugMode);
  const setDebugMode = useAppStore((state) => state.setDebugMode);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("panelTitle")}
      </h2>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
            className="size-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
          />
          {t("debugMode.label")}
        </label>
        <ConnectionStatusPill status={connectionStatus} />
      </div>
    </header>
  );
}
