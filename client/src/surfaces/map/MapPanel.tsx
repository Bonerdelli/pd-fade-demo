import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MapCamera } from "@pd-fade/shared";
import { AgentMovedIndicator } from "../../components/AgentMovedIndicator.js";
import { RunLockHint } from "../../components/RunLockHint.js";
import { useCameraCommand, useMutations, useRunLock } from "../../hooks/index.js";
import { useAppStore } from "../../store/index.js";
import { AgentShapePopup } from "./components/AgentShapePopup.js";
import { MapToolbar } from "./components/MapToolbar.js";
import { useAgentLayers } from "./hooks/use-agent-layers.js";
import { useDrawTools, type DrawToolMode } from "./hooks/use-draw-tools.js";
import { useMapInstance } from "./hooks/use-map-instance.js";

export function MapPanel() {
  const { t } = useTranslation("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticMoveRef = useRef(false);
  const isUserGesturingRef = useRef(false);
  const initialViewport = useAppStore((state) => state.userState.viewports.map);
  const agentShapeIds = useAppStore((state) =>
    new Set(state.agentState.map.shapes.map((shape) => shape.id)),
  );
  const isRunLocked = useRunLock();
  const { upsertUserShape, deleteUserShape, addComment, setViewport } = useMutations();

  const [selectedAgentShape, setSelectedAgentShape] = useState<{
    shapeId: string;
    label: string;
  } | null>(null);

  const visibleAgentShape =
    selectedAgentShape && agentShapeIds.has(selectedAgentShape.shapeId)
      ? selectedAgentShape
      : null;

  const handleUserViewportChange = useCallback(
    (camera: MapCamera) => {
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

  const { drawMode, setDrawMode, deleteSelected, hasSelection } = useDrawTools({
    mapRef,
    isRunLocked,
    upsertUserShape,
    deleteUserShape,
  });

  const applyMapCamera = useCallback(
    (camera: MapCamera) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }
      map.flyTo({
        center: camera.center,
        zoom: camera.zoom,
        essential: true,
      });
    },
    [mapRef],
  );

  const { showAgentMoved } = useCameraCommand({
    target: "map",
    applyCamera: applyMapCamera,
    isProgrammaticMoveRef,
    isUserGesturingRef,
  });

  const handleModeChange = useCallback(
    (mode: DrawToolMode) => {
      setDrawMode(mode);
    },
    [setDrawMode],
  );

  const handleAddComment = useCallback(
    (text: string) => {
      if (!visibleAgentShape) {
        return;
      }
      addComment({
        id: crypto.randomUUID(),
        targetShapeId: visibleAgentShape.shapeId,
        text,
      });
    },
    [addComment, visibleAgentShape],
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
          activeMode={drawMode}
          disabled={isRunLocked}
          canDelete={hasSelection}
          onModeChange={handleModeChange}
          onDelete={deleteSelected}
        />

        <AgentMovedIndicator visible={showAgentMoved} namespace="map" />

        {isRunLocked ? <RunLockHint namespace="map" /> : null}

        {visibleAgentShape ? (
          <AgentShapePopup
            shapeId={visibleAgentShape.shapeId}
            label={visibleAgentShape.label}
            disabled={isRunLocked}
            onClose={() => setSelectedAgentShape(null)}
            onAddComment={handleAddComment}
          />
        ) : null}
      </div>
    </section>
  );
}
