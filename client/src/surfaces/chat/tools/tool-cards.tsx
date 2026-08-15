import { useTranslation } from "react-i18next";
import { useAppStore } from "../../../store/index.js";
import type { ToolCardContentProps, ToolCardSummaryProps } from "./tool-card-types.js";
import { formatArgsRaw } from "../lib/parse-tool-args.js";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function SearchEntitiesCard({ argsResult, result, status }: ToolCardContentProps) {
  const { t } = useTranslation("chat");

  const args = argsResult.kind === "parsed" ? argsResult.value : {};
  const query = readString(args.query) ?? t("toolCards.searchEntities.unknownQuery");
  const kinds = readStringArray(args.kinds);
  const city = readString(args.city);

  const resultRecord =
    result !== undefined && result !== null && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const matchCount =
    readNumber(resultRecord?.matchCount) ??
    (Array.isArray(resultRecord?.entities) ? resultRecord.entities.length : null);

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-slate-800">{t("toolCards.searchEntities.title")}</p>
      <dl className="grid gap-1 text-slate-600">
        <div>
          <dt className="inline font-medium text-slate-700">{t("toolCards.searchEntities.query")}: </dt>
          <dd className="inline">{query}</dd>
        </div>
        {kinds.length > 0 ? (
          <div>
            <dt className="inline font-medium text-slate-700">{t("toolCards.searchEntities.kinds")}: </dt>
            <dd className="inline">{kinds.join(", ")}</dd>
          </div>
        ) : null}
        {city ? (
          <div>
            <dt className="inline font-medium text-slate-700">{t("toolCards.searchEntities.city")}: </dt>
            <dd className="inline">{city}</dd>
          </div>
        ) : null}
      </dl>
      {status === "ok" && matchCount !== null ? (
        <p className="text-slate-700">
          {t("toolCards.searchEntities.result", { count: matchCount })}
        </p>
      ) : null}
    </div>
  );
}

export function SearchEntitiesSummary({ argsResult, result, status }: ToolCardSummaryProps) {
  const { t } = useTranslation("chat");
  const args = argsResult.kind === "parsed" ? argsResult.value : {};
  const query = readString(args.query) ?? t("toolCards.searchEntities.unknownQuery");
  const resultRecord =
    result !== undefined && result !== null && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const matchCount =
    readNumber(resultRecord?.matchCount) ??
    (Array.isArray(resultRecord?.entities) ? resultRecord.entities.length : null);

  if (status === "ok" && matchCount !== null) {
    return (
      <span>
        {t("toolCards.searchEntities.summary", { query, count: matchCount })}
      </span>
    );
  }

  return <span>{t("toolCards.searchEntities.summaryRunning", { query })}</span>;
}

export function PlotSignalsCard({ argsResult, result, status }: ToolCardContentProps) {
  const { t } = useTranslation("chat");

  const args = argsResult.kind === "parsed" ? argsResult.value : {};
  const signalIds = readStringArray(args.signalIds);
  const center = Array.isArray(args.center) ? args.center : null;

  const resultRecord =
    result !== undefined && result !== null && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const plotted = readNumber(resultRecord?.plotted) ?? signalIds.length;

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-slate-800">{t("toolCards.plotSignals.title")}</p>
      <dl className="grid gap-1 text-slate-600">
        <div>
          <dt className="inline font-medium text-slate-700">{t("toolCards.plotSignals.signals")}: </dt>
          <dd className="inline">
            {signalIds.length > 0
              ? t("toolCards.plotSignals.signalCount", { count: signalIds.length })
              : t("toolCards.plotSignals.noSignals")}
          </dd>
        </div>
        {center ? (
          <div>
            <dt className="inline font-medium text-slate-700">{t("toolCards.plotSignals.center")}: </dt>
            <dd className="inline font-mono text-xs">
              [{center.map((value) => String(value)).join(", ")}]
            </dd>
          </div>
        ) : null}
      </dl>
      {status === "ok" ? (
        <p className="text-slate-700">{t("toolCards.plotSignals.result", { count: plotted })}</p>
      ) : null}
    </div>
  );
}

export function PlotSignalsSummary({ argsResult, result, status }: ToolCardSummaryProps) {
  const { t } = useTranslation("chat");
  const args = argsResult.kind === "parsed" ? argsResult.value : {};
  const signalIds = readStringArray(args.signalIds);
  const resultRecord =
    result !== undefined && result !== null && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const plotted = readNumber(resultRecord?.plotted) ?? signalIds.length;

  if (status === "ok") {
    return <span>{t("toolCards.plotSignals.summary", { count: plotted })}</span>;
  }

  return (
    <span>
      {t("toolCards.plotSignals.summaryRunning", {
        count: signalIds.length,
      })}
    </span>
  );
}

export function FallbackToolCard({ name, argsResult, status }: ToolCardContentProps) {
  const { t } = useTranslation("chat");
  const debugMode = useAppStore((state) => state.uiState.debugMode);
  const raw =
    argsResult.kind === "parsed"
      ? formatArgsRaw(argsResult.value)
      : argsResult.raw || t("toolCards.fallback.noArgs");

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-slate-800">
        {t("toolCards.fallback.executed", { toolName: name })}
      </p>
      {argsResult.kind === "streaming" ? (
        <p className="text-slate-500">{t("toolCards.fallback.receivingArgs")}</p>
      ) : debugMode ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700">
          {raw}
        </pre>
      ) : null}
      {status === "error" ? (
        <p className="text-red-700">{t("toolCards.fallback.failed")}</p>
      ) : null}
    </div>
  );
}

export function FallbackToolSummary({ name, status }: ToolCardSummaryProps) {
  const { t } = useTranslation("chat");

  if (status === "error") {
    return <span>{t("toolCards.fallback.summaryError", { toolName: name })}</span>;
  }

  if (status === "cancelled") {
    return <span>{t("toolCards.fallback.summaryCancelled", { toolName: name })}</span>;
  }

  return <span>{t("toolCards.fallback.summary", { toolName: name })}</span>;
}
