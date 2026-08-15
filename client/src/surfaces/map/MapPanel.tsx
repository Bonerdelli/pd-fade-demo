import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutations, useRunLock } from "../../hooks/index.js";
import { useAppStore } from "../../store/index.js";
import { AgentMovedIndicator } from "./components/AgentMovedIndicator.js";
import { AgentShapePopup } from "./components/AgentShapePopup.js";
import { MapToolbar } from "./components/MapToolbar.js";
import { RunLockHint } from "./components/RunLockHint.js";
import { useAgentLayers } from "./hooks/use-agent-layers.js";
import { useCameraCommand } from "./hooks/use-camera-command.js";
import { useDrawTools, type DrawToolMode } from "./hooks/use-draw-tools.js";
import { useMapInstance } from "./hooks/use-map-instance.js";

export function MapPanel() {
  const { t } = useTranslation("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticMoveRef = useRef(false);
  const isUserGesturingRef = useRef(false);
  const initialViewport = useAppStore((state) => state.userState.viewports.map);
  const isRunLocked = useRunLock();
  const { upsertUserShape, deleteUserShape, addComment, setViewport } = useMutations();

  const [activeMode, setActiveMode] = useState<DrawToolMode>("select");
  const [selectedAgentShape, setSelectedAgentShape] = useState<{
    shapeId: string;
    label: string;
  } | null>(null);

  const handleUserViewportChange = useCallback(
    (camera: { center: [number, number]; zoom: number }) => {
      setViewport({
        type: "setViewport",
        target: "map",
        camera,
      });
    },
    [setViewport],
  );

  const mapRef = useMapInstance({
    containerRef,
    initialViewport,
    onUserViewportChange: handleUserViewportChange,
    isProgrammaticMoveRef,
    isUserGesturingRef,
  });

  const handleAgentShapeClick = useCallback(
    (selection: { shapeId: string; label: string }) => {
      setSelectedAgentShape(selection);
    },
    [],
  );

  useAgentLayers({
    mapRef,
    onAgentShapeClick: handleAgentShapeClick,
  });

  const { setDrawMode, deleteSelected, hasSelection } = useDrawTools({
    mapRef,
    isRunLocked,
    upsertUserShape,
    deleteUserShape,
  });

  const { showAgentMoved } = useCameraCommand({
    mapRef,
    isProgrammaticMoveRef,
    isUserGesturingRef,
  });

  const handleModeChange = useCallback(
    (mode: DrawToolMode) => {
      setActiveMode(mode);
      setDrawMode(mode);
    },
    [setDrawMode],
  );

  const handleAddComment = useCallback(
    (text: string) => {
      if (!selectedAgentShape) {
        return;
      }
      addComment({
        id: crypto.randomUUID(),
        targetShapeId: selectedAgentShape.shapeId,
        text,
      });
    },
    [addComment, selectedAgentShape],
  );

  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("panelTitle")}
        </h2>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" data-testid="map-container" />

        <MapToolbar
          activeMode={activeMode}
          disabled={isRunLocked}
          canDelete={hasSelection}
          onModeChange={handleModeChange}
          onDelete={deleteSelected}
        />

        <AgentMovedIndicator visible={showAgentMoved} />

        {isRunLocked ? <RunLockHint /> : null}

        {selectedAgentShape ? (
          <AgentShapePopup
            shapeId={selectedAgentShape.shapeId}
            label={selectedAgentShape.label}
            disabled={isRunLocked}
            onClose={() => setSelectedAgentShape(null)}
            onAddComment={handleAddComment}
          />
        ) : null}
      </div>
    </section>
  );
}
