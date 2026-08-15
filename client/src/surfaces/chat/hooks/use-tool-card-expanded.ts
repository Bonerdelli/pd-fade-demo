import { useCallback, useMemo, useState } from "react";
import type { ChatMessage } from "@pd-fade/shared";
import {
  resolveLatestToolCallId,
  shouldExpandByDefault,
} from "../lib/tool-card-collapse.js";

function pruneManualExpanded(
  manualExpanded: Record<string, boolean>,
  _latestToolCallId: string | null,
): Record<string, boolean> {
  return { ...manualExpanded };
}

export function useToolCardExpandedState(chat: ChatMessage[]) {
  const latestToolCallId = resolveLatestToolCallId(chat);
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const effectiveManualExpanded = useMemo(
    () => pruneManualExpanded(manualExpanded, latestToolCallId),
    [manualExpanded, latestToolCallId],
  );

  const isExpanded = useCallback(
    (toolCallId: string) => {
      if (toolCallId in effectiveManualExpanded) {
        return effectiveManualExpanded[toolCallId] === true;
      }
      return shouldExpandByDefault(toolCallId, latestToolCallId);
    },
    [effectiveManualExpanded, latestToolCallId],
  );

  const toggleExpanded = useCallback(
    (toolCallId: string) => {
      setManualExpanded((previous) => {
        const pruned = pruneManualExpanded(previous, latestToolCallId);
        const current =
          toolCallId in pruned
            ? pruned[toolCallId] === true
            : shouldExpandByDefault(toolCallId, latestToolCallId);
        return {
          ...pruned,
          [toolCallId]: !current,
        };
      });
    },
    [latestToolCallId],
  );

  return { isExpanded, toggleExpanded, latestToolCallId };
}
