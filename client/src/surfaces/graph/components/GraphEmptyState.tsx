import { useTranslation } from "react-i18next";

export function GraphEmptyState() {
  const { t } = useTranslation("graph");

  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-sm text-center text-sm text-slate-500">{t("emptyState")}</p>
    </div>
  );
}
