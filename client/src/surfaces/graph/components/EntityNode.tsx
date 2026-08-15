import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { EntityNodeData } from "../hooks/use-graph-elements.js";

const kindStyles: Record<string, string> = {
  company: "bg-sky-100 text-sky-800 border-sky-200",
  person: "bg-emerald-100 text-emerald-800 border-emerald-200",
  location: "bg-amber-100 text-amber-800 border-amber-200",
};

function EntityNodeComponent({ data, selected }: NodeProps) {
  const { t } = useTranslation("graph");
  const nodeData = data as unknown as EntityNodeData;
  const badgeClass = kindStyles[nodeData.kind] ?? "bg-slate-100 text-slate-700 border-slate-200";
  const kindLabel = t(`nodeKind.${nodeData.kind}`, {
    defaultValue: t("nodeKind.default"),
  });

  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-white px-3 py-2 shadow-sm transition-shadow ${
        selected
          ? "border-violet-500 ring-2 ring-violet-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex flex-col gap-1.5">
        <span
          className={`inline-flex w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
        >
          {kindLabel}
        </span>
        <span className="text-sm font-medium leading-snug text-slate-900">{nodeData.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
