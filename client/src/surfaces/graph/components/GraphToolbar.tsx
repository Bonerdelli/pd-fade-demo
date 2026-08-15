import { useTranslation } from "react-i18next";

export interface GraphToolbarProps {
  showRealign: boolean;
  disabled: boolean;
  onRealign: () => void;
}

export function GraphToolbar({ showRealign, disabled, onRealign }: GraphToolbarProps) {
  const { t } = useTranslation("graph");

  if (!showRealign) {
    return null;
  }

  return (
    <div className="absolute left-3 top-3 z-10">
      <button
        type="button"
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        title={t("realign.tooltip")}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onRealign}
      >
        {t("realign.label")}
      </button>
    </div>
  );
}
