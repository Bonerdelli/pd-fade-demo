import { useTranslation } from "react-i18next";
import type { DrawToolMode } from "../hooks/use-draw-tools.js";

export interface MapToolbarProps {
  activeMode: DrawToolMode;
  disabled: boolean;
  canDelete: boolean;
  onModeChange: (mode: DrawToolMode) => void;
  onDelete: () => void;
}

export function MapToolbar({
  activeMode,
  disabled,
  canDelete,
  onModeChange,
  onDelete,
}: MapToolbarProps) {
  const { t } = useTranslation("map");

  const buttonClass = (mode: DrawToolMode) =>
    [
      "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
      activeMode === mode ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100",
      disabled ? "cursor-not-allowed opacity-50" : "",
    ].join(" ");

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      <button
        type="button"
        className={buttonClass("select")}
        disabled={disabled}
        onClick={() => onModeChange("select")}
        aria-pressed={activeMode === "select"}
      >
        {t("toolbar.select")}
      </button>
      <button
        type="button"
        className={buttonClass("point")}
        disabled={disabled}
        onClick={() => onModeChange("point")}
        aria-pressed={activeMode === "point"}
      >
        {t("toolbar.point")}
      </button>
      <button
        type="button"
        className={buttonClass("polygon")}
        disabled={disabled}
        onClick={() => onModeChange("polygon")}
        aria-pressed={activeMode === "polygon"}
      >
        {t("toolbar.polygon")}
      </button>
      <button
        type="button"
        className="rounded px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !canDelete}
        onClick={onDelete}
      >
        {t("toolbar.delete")}
      </button>
    </div>
  );
}
