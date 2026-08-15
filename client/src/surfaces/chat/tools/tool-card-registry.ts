import type { ComponentType } from "react";
import type { ToolArgsParseResult } from "../lib/parse-tool-args.js";
import {
  FallbackToolCard,
  FallbackToolSummary,
  PlotSignalsCard,
  PlotSignalsSummary,
  SearchEntitiesCard,
  SearchEntitiesSummary,
} from "./tool-cards.js";
import type { ToolCardContentProps, ToolCardSummaryProps } from "./tool-card-types.js";

interface ToolCardDefinition {
  Card: ComponentType<ToolCardContentProps>;
  Summary: ComponentType<ToolCardSummaryProps>;
}

const TOOL_CARD_REGISTRY: Record<string, ToolCardDefinition> = {
  search_entities: {
    Card: SearchEntitiesCard,
    Summary: SearchEntitiesSummary,
  },
  plot_signals: {
    Card: PlotSignalsCard,
    Summary: PlotSignalsSummary,
  },
};

const FALLBACK_DEFINITION: ToolCardDefinition = {
  Card: FallbackToolCard,
  Summary: FallbackToolSummary,
};

export function resolveToolCardDefinition(
  name: string,
  argsResult: ToolArgsParseResult,
): ToolCardDefinition {
  if (argsResult.kind === "invalid") {
    return FALLBACK_DEFINITION;
  }

  return TOOL_CARD_REGISTRY[name] ?? FALLBACK_DEFINITION;
}

export { TOOL_CARD_REGISTRY, FALLBACK_DEFINITION };
