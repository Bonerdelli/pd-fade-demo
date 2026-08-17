import type { ConnectionStatus } from "../../store/types.js";

interface ConnectionStatusPillProps {
  status: ConnectionStatus;
}

/** Temporarily hidden: the Connected/Disconnected pill flickered and distracted. */
export function ConnectionStatusPill(_props: ConnectionStatusPillProps) {
  return null;
}
