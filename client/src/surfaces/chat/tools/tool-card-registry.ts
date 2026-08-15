import type { ComponentType } from "react";
import type { ChatToolCallStatus } from "@pd-fade/shared";
import type { ToolArgsParseResult } from "../lib/parse-tool-args.js";
import {
  fallbackHasDetails,
  plotSignalsHasDetails,
  searchEntitiesHasDetails,
} from "./tool-card-details.js";
import {
  FallbackToolCard,
  FallbackToolSummary,
  PlotSignalsCard,
  PlotSignalsSummary,
  SearchEntitiesCard,
  SearchEntitiesSummary,
} from "./tool-cards.js";
import type {
  ToolCardContentProps,
  ToolCardHasDetailsProps,
  ToolCardSummaryProps,
} from "./tool-card-types.js";

interface ToolCardDefinition {
  Card: ComponentType<ToolCardContentProps>;
  Summary: ComponentType<ToolCardSummaryProps>;
  hasDetails: (props: ToolCardHasDetailsProps) => boolean;
}

const TOOL_CARD_REGISTRY: Record<string, ToolCardDefinition> = {
  search_entities: {
    Card: SearchEntitiesCard,
    Summary: SearchEntitiesSummary,
    hasDetails: searchEntitiesHasDetails,
  },
  plot_signals: {
    Card: PlotSignalsCard,
    Summary: PlotSignalsSummary,
    hasDetails: plotSignalsHasDetails,
  },
};

const FALLBACK_DEFINITION: ToolCardDefinition = {
  Card: FallbackToolCard,
  Summary: FallbackToolSummary,
  hasDetails: fallbackHasDetails,
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

export function toolCardHasExpandableDetails(
  name: string,
  argsResult: ToolArgsParseResult,
  status: ChatToolCallStatus,
  result: unknown,
  debugMode: boolean,
): boolean {
  if (argsResult.kind === "streaming") {
    return true;
  }
  if (status === "error" || status === "cancelled") {
    return true;
  }

  const definition = resolveToolCardDefinition(name, argsResult);
  return definition.hasDetails({ name, status, argsResult, result, debugMode });
}

export { TOOL_CARD_REGISTRY, FALLBACK_DEFINITION };
