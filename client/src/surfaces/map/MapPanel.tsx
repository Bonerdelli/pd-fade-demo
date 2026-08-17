import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MapCamera } from "@pd-fade/shared";
import { AgentMovedIndicator } from "../../components/AgentMovedIndicator.js";
import { CanvasErrorOverlay } from "../../components/CanvasErrorOverlay.js";
import { RunLockHint } from "../../components/RunLockHint.js";
import { useCameraCommand, useMutations, useRunLock } from "../../hooks/index.js";
import { useAppStore } from "../../store/index.js";
import { AgentShapePopup } from "./components/AgentShapePopup.js";
import { MapToolbar } from "./components/MapToolbar.js";
import { useAgentLayers } from "./hooks/use-agent-layers.js";
import { useAgentShapeIds } from "./hooks/use-agent-shape-ids.js";
import { useDrawTools, type DrawToolMode } from "./hooks/use-draw-tools.js";
import { useMapInstance } from "./hooks/use-map-instance.js";

export function MapPanel() {
  const { t } = useTranslation("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticMoveRef = useRef(false);
  const isUserGesturingRef = useRef(false);
  const initialViewport = useAppStore((state) => state.userState.viewports.map);
  const agentShapeIds = useAgentShapeIds();
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

  const { mapRef, mapReadyEpoch, mapErrorKey } = useMapInstance({
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
    mapReadyEpoch,
    onAgentShapeClick: handleAgentShapeClick,
  });

  const { drawMode, setDrawMode, deleteSelected, hasSelection } = useDrawTools({
    mapRef,
    mapReadyEpoch,
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
    <section className="relative h-full min-h-0">
      <div ref={containerRef} className="h-full w-full min-h-0" data-testid="map-container" />

      {mapErrorKey ? (
        <CanvasErrorOverlay message={t(mapErrorKey)} overlay />
      ) : null}

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
    </section>
  );
}
