import { useTranslation } from "react-i18next";
import { PANEL_HEADER_BUTTON_CLASS, PanelHeader } from "../../components/PanelHeader.js";
import { useAppStore } from "../../store/index.js";
import { ConnectionStatusPill } from "./ConnectionStatusPill.js";

export function ChatHeader() {
  const { t } = useTranslation("chat");
  const connectionStatus = useAppStore((state) => state.uiState.connectionStatus);
  const startNewSession = useAppStore((state) => state.startNewSession);

  return (
    <PanelHeader
      title={t("panelTitle")}
      actions={
        <>
          <button
            type="button"
            className={`${PANEL_HEADER_BUTTON_CLASS} bg-slate-100 font-medium text-slate-700 hover:bg-slate-200`}
            onClick={() => startNewSession?.()}
          >
            {t("newChat")}
          </button>
          <ConnectionStatusPill status={connectionStatus} />
        </>
      }
    />
  );
}
