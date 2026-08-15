import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n.js";
import { CanvasErrorOverlay } from "./CanvasErrorOverlay.js";

export type CanvasSurface = "graph" | "map";

export interface CanvasSurfaceErrorBoundaryProps {
  surface: CanvasSurface;
  children: ReactNode;
}

interface CanvasSurfaceErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

export class CanvasSurfaceErrorBoundary extends Component<
  CanvasSurfaceErrorBoundaryProps,
  CanvasSurfaceErrorBoundaryState
> {
  state: CanvasSurfaceErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<CanvasSurfaceErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Canvas surface ${this.props.surface} crashed`, error, info);
  }

  handleRetry = () => {
    this.setState((state) => ({
      error: null,
      resetKey: state.resetKey + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return (
        <CanvasErrorOverlay
          message={i18n.t(`canvasError.${this.props.surface}`, { ns: "common" })}
          onRetry={this.handleRetry}
        />
      );
    }

    return (
      <div key={this.state.resetKey} className="h-full min-h-0">
        {this.props.children}
      </div>
    );
  }
}
