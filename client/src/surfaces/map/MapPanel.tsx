import { useTranslation } from "react-i18next";

export function MapPanel() {
  const { t } = useTranslation("map");

  return (
    <section className="flex h-full flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("panelTitle")}
      </h2>
      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        {t("placeholder")}
      </div>
    </section>
  );
}
