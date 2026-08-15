import { useTranslation } from "react-i18next";

export function RunLockHint() {
  const { t } = useTranslation("graph");

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow-sm">
      {t("runLock.hint")}
    </div>
  );
}
