import { useTranslation } from "react-i18next";

export function ChatPanel() {
  const { t } = useTranslation("chat");

  return (
    <section className="flex h-full flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("panelTitle")}
      </h2>
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        {t("placeholder")}
      </p>
    </section>
  );
}
