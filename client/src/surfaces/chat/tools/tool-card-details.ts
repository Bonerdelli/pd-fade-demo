import type { ToolCardHasDetailsProps } from "./tool-card-types.js";

export function searchEntitiesHasDetails({ argsResult }: ToolCardHasDetailsProps): boolean {
  return argsResult.kind === "parsed";
}

export function plotSignalsHasDetails({ argsResult, debugMode }: ToolCardHasDetailsProps): boolean {
  if (!debugMode || argsResult.kind !== "parsed") {
    return false;
  }
  return Array.isArray(argsResult.value.center) && argsResult.value.center.length > 0;
}

export function fallbackHasDetails({ argsResult, debugMode }: ToolCardHasDetailsProps): boolean {
  if (argsResult.kind === "streaming") {
    return true;
  }
  return debugMode;
}
