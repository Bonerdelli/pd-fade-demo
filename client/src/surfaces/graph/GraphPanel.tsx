import { useTranslation } from "react-i18next";
import { GraphCanvas } from "./GraphCanvas.js";

export function GraphPanel() {
  const { t } = useTranslation("graph");

  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("panelTitle")}
        </h2>
      </header>
      <div className="relative min-h-0 flex-1">
        <GraphCanvas />
      </div>
    </section>
  );
}
