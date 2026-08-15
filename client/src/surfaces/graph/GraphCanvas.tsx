import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnMove,
  type OnSelectionChangeParams,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentMovedIndicator } from "../../components/AgentMovedIndicator.js";
import { RunLockHint } from "../../components/RunLockHint.js";
import { useCameraCommand, useMutations, useRunLock } from "../../hooks/index.js";
import { GRAPH_CAMERA_ANIMATION_MS } from "../../lib/camera-constants.js";
import { useAppStore } from "../../store/index.js";
import { EntityNode } from "./components/EntityNode.js";
import { GraphEmptyState } from "./components/GraphEmptyState.js";
import { GraphToolbar } from "./components/GraphToolbar.js";
import { useGraphElements } from "./hooks/use-graph-elements.js";
import { hasLayoutDivergence } from "./lib/positions.js";

const nodeTypes = { entity: EntityNode };

function GraphCanvasInner() {
  const graph = useAppStore((state) => state.agentState.graph);
  const positionOverrides = useAppStore((state) => state.userState.positionOverrides);
  const selection = useAppStore((state) => state.userState.selection);
  const savedViewport = useAppStore((state) => state.userState.viewports.graph);
  const isRunLocked = useRunLock();
  const { clearPositionOverrides, setPositionOverride, setSelection, setViewport } = useMutations();
  const { setViewport: setReactFlowViewport } = useReactFlow();

  const isProgrammaticMoveRef = useRef(false);
  const isUserGesturingRef = useRef(false);

  const { nodes, edges } = useGraphElements(graph, positionOverrides, selection);
  const showRealign = useMemo(
    () => hasLayoutDivergence(positionOverrides, graph.layout),
    [graph.layout, positionOverrides],
  );

  const applyGraphCamera = useCallback(
    (camera: { x: number; y: number; zoom: number }) => {
      void setReactFlowViewport(
        { x: camera.x, y: camera.y, zoom: camera.zoom },
        { duration: GRAPH_CAMERA_ANIMATION_MS },
      );
    },
    [setReactFlowViewport],
  );

  const { showAgentMoved } = useCameraCommand({
    target: "graph",
    applyCamera: applyGraphCamera,
    isProgrammaticMoveRef,
    isUserGesturingRef,
  });

  const defaultViewport = savedViewport ?? { x: 0, y: 0, zoom: 1 };

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setSelection(selectedNodes.map((node) => node.id));
    },
    [setSelection],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      isUserGesturingRef.current = false;
      setPositionOverride(node.id, node.position);
    },
    [isUserGesturingRef, setPositionOverride],
  );

  const handleMoveStart = useCallback<OnMove>((event) => {
    if (event) {
      isUserGesturingRef.current = true;
    }
  }, [isUserGesturingRef]);

  const handleMoveEnd = useCallback<OnMove>(
    (_event, viewport: Viewport) => {
      isUserGesturingRef.current = false;

      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }

      setViewport({
        type: "setViewport",
        target: "graph",
        camera: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        },
      });
    },
    [isProgrammaticMoveRef, isUserGesturingRef, setViewport],
  );

  const handleNodeDragStart = useCallback(() => {
    isUserGesturingRef.current = true;
  }, [isUserGesturingRef]);

  if (graph.nodes.length === 0) {
    return <GraphEmptyState />;
  }

  return (
    <div className="relative h-full w-full" data-testid="graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        nodesDraggable={!isRunLocked}
        nodesConnectable={false}
        elementsSelectable
        fitView={savedViewport === null}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onSelectionChange={handleSelectionChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!border-slate-200 !shadow-sm" />
        <MiniMap
          nodeStrokeWidth={3}
          className="!border-slate-200 !bg-white !shadow-sm"
          maskColor="rgba(148, 163, 184, 0.15)"
        />
      </ReactFlow>

      <GraphToolbar
        showRealign={showRealign}
        disabled={isRunLocked}
        onRealign={clearPositionOverrides}
      />
      <AgentMovedIndicator visible={showAgentMoved} namespace="graph" />
      {isRunLocked ? <RunLockHint namespace="graph" /> : null}
    </div>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}
