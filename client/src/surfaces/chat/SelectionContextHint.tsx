import { useTranslation } from "react-i18next";
import { useMutations } from "../../hooks/use-mutations.js";
import { useAppStore } from "../../store/index.js";

export function SelectionContextHint() {
  const { t } = useTranslation("chat");
  const selection = useAppStore((state) => state.userState.selection);
  const { setSelection } = useMutations();

  if (selection.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
      <span className="min-w-0 flex-1">{t("selectionContext.hint", { count: selection.length })}</span>
      <button
        type="button"
        onClick={() => setSelection([])}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
        aria-label={t("selectionContext.clear")}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
