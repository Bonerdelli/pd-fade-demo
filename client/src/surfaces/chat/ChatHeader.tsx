import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/index.js";
import { ConnectionStatusPill } from "./ConnectionStatusPill.js";

export function ChatHeader() {
  const { t } = useTranslation("chat");
  const connectionStatus = useAppStore((state) => state.uiState.connectionStatus);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("panelTitle")}
      </h2>
      <ConnectionStatusPill status={connectionStatus} />
    </header>
  );
}
