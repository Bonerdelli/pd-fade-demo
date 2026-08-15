import { describe, expect, it } from "vitest";
import type { MapShape, Signal } from "@pd-fade/shared";
import {
  agentShapesToCollection,
  drawFeatureToMapShape,
  mapShapeToDrawFeature,
  mapShapeToFeature,
  serializeMapShape,
  signalToFeature,
  signalsToCollection,
} from "./geojson.js";

const pointShape: MapShape = {
  id: "shape-hq",
  kind: "point",
  coordinates: [13.405, 52.52],
  label: "TechBerlin HQ",
};

const polygonShape: MapShape = {
  id: "shape-mitte",
  kind: "polygon",
  coordinates: [
    [
      [13.38, 52.53],
      [13.42, 52.53],
      [13.42, 52.51],
      [13.38, 52.51],
      [13.38, 52.53],
    ],
  ],
  label: "Mitte",
};

const signal: Signal = {
  id: "signal-1",
  coordinates: [13.3777, 52.5163],
  label: "Brandenburg Gate activity",
  strength: 0.82,
};

describe("geojson helpers", () => {
  it("maps agent shapes to GeoJSON features", () => {
    const point = mapShapeToFeature(pointShape);
    expect(point.geometry.type).toBe("Point");
    expect(point.properties.shapeId).toBe("shape-hq");
    expect(point.properties.label).toBe("TechBerlin HQ");

    const polygon = mapShapeToFeature(polygonShape);
    expect(polygon.geometry.type).toBe("Polygon");
    expect(polygon.properties.kind).toBe("polygon");
  });

  it("builds feature collections for agent layers", () => {
    const shapes = agentShapesToCollection([pointShape, polygonShape]);
    expect(shapes.features).toHaveLength(2);

    const signals = signalsToCollection([signal]);
    expect(signals.features[0]?.properties?.signalId).toBe("signal-1");
    expect(signalToFeature(signal).properties.strength).toBe(0.82);
  });

  it("round-trips user shapes through terra-draw features", () => {
    const pointRoundTrip = drawFeatureToMapShape(mapShapeToDrawFeature(pointShape));
    expect(pointRoundTrip).toEqual({
      id: "shape-hq",
      kind: "point",
      coordinates: [13.405, 52.52],
    });

    const polygonRoundTrip = drawFeatureToMapShape(mapShapeToDrawFeature(polygonShape));
    expect(polygonRoundTrip?.kind).toBe("polygon");
    expect(polygonRoundTrip?.id).toBe("shape-mitte");
  });

  it("serializes shapes for sync comparisons", () => {
    expect(serializeMapShape(pointShape)).toContain("shape-hq");
    expect(serializeMapShape(pointShape)).toEqual(serializeMapShape({ ...pointShape }));
  });
});
