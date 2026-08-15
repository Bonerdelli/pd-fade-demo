import { useTranslation } from "react-i18next";
import { useSessionBootstrap } from "./hooks";
import { useAppStore } from "./store";
import { ChatPanel } from "./surfaces/chat/ChatPanel";
import { GraphPanel } from "./surfaces/graph/GraphPanel";
import { MapPanel } from "./surfaces/map/MapPanel";

function SessionBootstrap() {
  useSessionBootstrap();
  return null;
}

export function App() {
  const { t } = useTranslation("common");
  const activeTab = useAppStore((state) => state.uiState.activeCanvasTab);
  const bootstrapStatus = useAppStore((state) => state.uiState.bootstrapStatus);
  const connectionStatus = useAppStore((state) => state.uiState.connectionStatus);
  const mutationError = useAppStore((state) => state.uiState.mutationError);
  const setActiveCanvasTab = useAppStore((state) => state.setActiveCanvasTab);

  const statusKey =
    bootstrapStatus === "loading"
      ? "status.loading"
      : bootstrapStatus === "error"
        ? "status.error"
        : connectionStatus === "connected"
          ? "status.connected"
          : connectionStatus === "reconnecting"
            ? "status.reconnecting"
            : "status.disconnected";

  const mutationErrorText = mutationError
    ? t(mutationError.key, mutationError.params)
    : null;

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <SessionBootstrap />

      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold">{t("appTitle")}</h1>
        <p className="text-sm text-slate-500">{t(statusKey)}</p>
        {mutationErrorText ? (
          <p className="mt-1 text-sm text-red-600">{mutationErrorText}</p>
        ) : null}
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          {bootstrapStatus === "ready" ? (
            <ChatPanel />
          ) : (
            <div className="p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-200" />
              <p className="mt-4 text-sm text-slate-500">{t("skeleton.chat")}</p>
            </div>
          )}
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
            {bootstrapStatus === "ready" ? (
              activeTab === "graph" ? (
                <GraphPanel />
              ) : (
                <MapPanel />
              )
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="w-full max-w-md space-y-3">
                  <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
                  <p className="text-center text-sm text-slate-500">{t("skeleton.canvas")}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
