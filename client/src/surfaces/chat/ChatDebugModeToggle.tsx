import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";

export function ChatDebugModeToggle() {
  const { t } = useTranslation("chat");
  const debugMode = useAppStore((state) => state.uiState.debugMode);
  const setDebugMode = useAppStore((state) => state.setDebugMode);

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2">
      <label className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={debugMode}
          onChange={(event) => setDebugMode(event.target.checked)}
          className="size-3 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
        />
        {t("debugMode.label")}
      </label>
    </div>
  );
}
