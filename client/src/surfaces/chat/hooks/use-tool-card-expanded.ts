import { useCallback, useMemo, useState } from "react";
import type { ChatMessage } from "@pd-fade/shared";
import {
  resolveLatestToolCallId,
  shouldExpandByDefault,
} from "../lib/tool-card-collapse.js";

function pruneManualExpanded(
  manualExpanded: Record<string, boolean>,
  latestToolCallId: string | null,
): Record<string, boolean> {
  const pruned: Record<string, boolean> = {};

  for (const [toolCallId, expanded] of Object.entries(manualExpanded)) {
    if (toolCallId === latestToolCallId) {
      pruned[toolCallId] = expanded;
      continue;
    }
    if (expanded === false) {
      pruned[toolCallId] = false;
    }
  }

  return pruned;
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
