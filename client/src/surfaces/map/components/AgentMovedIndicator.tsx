import { useTranslation } from "react-i18next";

export interface AgentMovedIndicatorProps {
  visible: boolean;
}

export function AgentMovedIndicator({ visible }: AgentMovedIndicatorProps) {
  const { t } = useTranslation("map");

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 shadow-sm">
      {t("camera.agentMovedView")}
    </div>
  );
}
