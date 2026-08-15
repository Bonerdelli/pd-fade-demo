import type { MapShape, Signal } from "@pd-fade/shared";

type Position = [number, number];

type PointGeometry = {
  type: "Point";
  coordinates: Position;
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: Position[][];
};

type ShapeGeometry = PointGeometry | PolygonGeometry;

export type AgentShapeProperties = {
  shapeId: string;
  label: string;
  kind: "point" | "polygon";
};

export type AgentSignalProperties = {
  signalId: string;
  label: string;
  strength: number;
};

export type GeoFeature<P> = {
  type: "Feature";
  id?: string;
  properties: P;
  geometry: ShapeGeometry | PointGeometry;
};

export type FeatureCollection<P = Record<string, unknown>> = {
  type: "FeatureCollection";
  features: GeoFeature<P>[];
};

export function mapShapeToFeature(shape: MapShape): GeoFeature<AgentShapeProperties> {
  if (shape.kind === "point") {
    return {
      type: "Feature",
      id: shape.id,
      properties: {
        shapeId: shape.id,
        label: shape.label ?? "",
        kind: "point",
      },
      geometry: {
        type: "Point",
        coordinates: shape.coordinates,
      },
    };
  }

  return {
    type: "Feature",
    id: shape.id,
    properties: {
      shapeId: shape.id,
      label: shape.label ?? "",
      kind: "polygon",
    },
    geometry: {
      type: "Polygon",
      coordinates: shape.coordinates,
    },
  };
}

export function agentShapesToCollection(shapes: MapShape[]): FeatureCollection<AgentShapeProperties> {
  return {
    type: "FeatureCollection",
    features: shapes.map(mapShapeToFeature),
  };
}

export function signalToFeature(signal: Signal): GeoFeature<AgentSignalProperties> {
  return {
    type: "Feature",
    id: signal.id,
    properties: {
      signalId: signal.id,
      label: signal.label,
      strength: signal.strength ?? 0.5,
    },
    geometry: {
      type: "Point",
      coordinates: signal.coordinates,
    },
  };
}

export function signalsToCollection(signals: Signal[]): FeatureCollection<AgentSignalProperties> {
  return {
    type: "FeatureCollection",
    features: signals.map(signalToFeature),
  };
}

export function mapShapeToDrawFeature(shape: MapShape): GeoFeature<{ mode: string }> {
  if (shape.kind === "point") {
    return {
      id: shape.id,
      type: "Feature",
      properties: {
        mode: "point",
      },
      geometry: {
        type: "Point",
        coordinates: shape.coordinates,
      },
    };
  }

  return {
    id: shape.id,
    type: "Feature",
    properties: {
      mode: "polygon",
    },
    geometry: {
      type: "Polygon",
      coordinates: shape.coordinates,
    },
  };
}

export function drawFeatureToMapShape(feature: {
  id?: string | number;
  geometry: ShapeGeometry | PointGeometry;
}): MapShape | null {
  const id = typeof feature.id === "string" ? feature.id : String(feature.id ?? "");
  if (!id) {
    return null;
  }

  const geometry = feature.geometry;
  if (geometry.type === "Point") {
    const coordinates = geometry.coordinates;
    if (coordinates.length < 2) {
      return null;
    }
    return {
      id,
      kind: "point",
      coordinates: [coordinates[0]!, coordinates[1]!],
    };
  }

  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    if (!ring || ring.length < 3) {
      return null;
    }
    return {
      id,
      kind: "polygon",
      coordinates: geometry.coordinates.map((coords: Position[]) =>
        coords.map((position: Position) => [position[0]!, position[1]!] as Position),
      ),
    };
  }

  return null;
}

export function serializeMapShape(shape: MapShape): string {
  return JSON.stringify(shape);
}
