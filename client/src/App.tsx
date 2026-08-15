import { useTranslation } from "react-i18next";
import { useAppStore } from "./store";
import { ChatPanel } from "./surfaces/chat/ChatPanel";
import { GraphPanel } from "./surfaces/graph/GraphPanel";
import { MapPanel } from "./surfaces/map/MapPanel";

export function App() {
  const { t } = useTranslation("common");
  const activeTab = useAppStore((state) => state.uiState.activeCanvasTab);
  const setActiveCanvasTab = useAppStore((state) => state.setActiveCanvasTab);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold">{t("appTitle")}</h1>
        <p className="text-sm text-slate-500">{t("status.placeholder")}</p>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <ChatPanel />
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("layout.canvasPanel")}
            </span>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm ${
                  activeTab === "graph" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setActiveCanvasTab("graph")}
              >
                {t("layout.graphTab")}
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm ${
                  activeTab === "map" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setActiveCanvasTab("map")}
              >
                {t("layout.mapTab")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-white">
            {activeTab === "graph" ? <GraphPanel /> : <MapPanel />}
          </div>
        </section>
      </main>
    </div>
  );
}
