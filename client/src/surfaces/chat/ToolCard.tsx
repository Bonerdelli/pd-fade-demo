import type { ChatMessage, ChatToolCallStatus } from "@pd-fade/shared";
import { useTranslation } from "react-i18next";
import { parseToolArgs } from "./lib/parse-tool-args.js";
import { resolveToolCardDefinition } from "./tools/tool-card-registry.js";

type ToolCallMessage = Extract<ChatMessage, { kind: "toolCall" }>;

const STATUS_RING: Record<ChatToolCallStatus, string> = {
  pending: "ring-slate-200",
  running: "ring-blue-200",
  ok: "ring-emerald-200",
  error: "ring-red-200",
  cancelled: "ring-slate-200",
};

const STATUS_BADGE: Record<ChatToolCallStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700",
  ok: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

interface ToolCardProps {
  message: ToolCallMessage;
  isExpanded: boolean;
  onToggle: () => void;
}

function readErrorMessage(result: unknown): string | null {
  if (result !== null && typeof result === "object" && "message" in result) {
    const message = (result as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

export function ToolCard({ message, isExpanded, onToggle }: ToolCardProps) {
  const { t } = useTranslation("chat");
  const hasResult = message.result !== undefined;
  const argsResult = parseToolArgs(message.args, hasResult);
  const definition = resolveToolCardDefinition(message.name, argsResult);
  const { Card, Summary } = definition;
  const isRunning = message.status === "running" || message.status === "pending";
  const errorMessage = message.status === "error" ? readErrorMessage(message.result) : null;

  const statusLabel = t(`toolCards.status.${message.status}`);

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm ring-1 ring-inset transition hover:bg-slate-50 ${STATUS_RING[message.status]}`}
        aria-expanded={false}
      >
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[message.status]}`}
        >
          {statusLabel}
        </span>
        <span className="min-w-0 truncate text-slate-700">
          <Summary
            name={message.name}
            status={message.status}
            argsResult={argsResult}
            result={message.result}
          />
        </span>
        <span className="ml-auto shrink-0 text-xs text-slate-400">{t("toolCards.expand")}</span>
      </button>
    );
  }

  return (
    <article
      className={`rounded-lg border border-slate-200 bg-white ring-1 ring-inset ${STATUS_RING[message.status]} ${
        isRunning ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[message.status]}`}
        >
          {statusLabel}
        </span>
        <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
          {t(`toolCards.toolNames.${message.name}`, { defaultValue: message.name })}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto text-xs text-slate-400 hover:text-slate-600"
          aria-expanded={true}
        >
          {t("toolCards.collapse")}
        </button>
      </div>
      <div className="px-3 py-3">
        {argsResult.kind === "streaming" ? (
          <p className="text-sm text-slate-500">{t("toolCards.fallback.receivingArgs")}</p>
        ) : (
          <Card
            name={message.name}
            status={message.status}
            argsResult={argsResult}
            result={message.result}
          />
        )}
        {message.status === "error" ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-800">
            {errorMessage ?? t("toolCards.error.generic")}
          </p>
        ) : null}
        {message.status === "cancelled" ? (
          <p className="mt-3 text-sm text-slate-500">{t("toolCards.cancelled")}</p>
        ) : null}
      </div>
    </article>
  );
}
