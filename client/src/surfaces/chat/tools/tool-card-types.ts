import type { ChatToolCallStatus } from "@pd-fade/shared";
import type { ToolArgsParseResult } from "../lib/parse-tool-args.js";

export interface ToolCardContentProps {
  name: string;
  status: ChatToolCallStatus;
  argsResult: ToolArgsParseResult;
  result: unknown;
}

export interface ToolCardSummaryProps {
  name: string;
  status: ChatToolCallStatus;
  argsResult: ToolArgsParseResult;
  result: unknown;
}

export interface ToolCardHasDetailsProps {
  name: string;
  status: ChatToolCallStatus;
  argsResult: ToolArgsParseResult;
  result: unknown;
  debugMode: boolean;
}
