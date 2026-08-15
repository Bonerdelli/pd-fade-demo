import { useTranslation } from "react-i18next";
import type { ConnectionStatus } from "../../store/types.js";

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  reconnecting: "bg-amber-100 text-amber-800 ring-amber-200",
  down: "bg-red-100 text-red-800 ring-red-200",
};

const STATUS_KEYS: Record<ConnectionStatus, string> = {
  connected: "connection.connected",
  reconnecting: "connection.reconnecting",
  down: "connection.down",
};

interface ConnectionStatusPillProps {
  status: ConnectionStatus;
}

export function ConnectionStatusPill({ status }: ConnectionStatusPillProps) {
  const { t } = useTranslation("chat");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
      aria-live="polite"
    >
      {t(STATUS_KEYS[status])}
    </span>
  );
}
