import { useTranslation } from "react-i18next";

export interface AgentMovedIndicatorProps {
  visible: boolean;
  namespace: "graph" | "map";
}

export function AgentMovedIndicator({ visible, namespace }: AgentMovedIndicatorProps) {
  const { t } = useTranslation(namespace);

  if (!visible) {
    return null;
  }

  return (
    <p
      role="status"
      className="pointer-events-none absolute right-3 top-3 z-10 text-xs font-medium text-blue-600"
    >
      {t("camera.agentMovedView")}
    </p>
  );
}
