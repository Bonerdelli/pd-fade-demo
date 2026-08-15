import type { GraphEdge, GraphNode, Signal } from "@pd-fade/shared";

export const BERLIN_CENTER: [number, number] = [13.405, 52.52];

export interface DatasetEntity {
  id: string;
  label: string;
  kind: string;
}

export interface DatasetEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface DatasetMapShape {
  id: string;
  kind: "point" | "polygon";
  coordinates: [number, number] | Array<Array<[number, number]>>;
  label?: string;
}

export const ENTITIES: readonly DatasetEntity[] = [
  { id: "company-techberlin", label: "TechBerlin GmbH", kind: "company" },
  { id: "company-spree", label: "Spree Ventures", kind: "company" },
  { id: "person-anna", label: "Anna Schmidt", kind: "person" },
  { id: "person-max", label: "Max Weber", kind: "person" },
  { id: "loc-brandenburg", label: "Brandenburg Gate", kind: "location" },
  { id: "loc-alexanderplatz", label: "Alexanderplatz", kind: "location" },
  { id: "loc-mitte", label: "Mitte District", kind: "location" },
  { id: "loc-kreuzberg", label: "Kreuzberg District", kind: "location" },
];

export const EDGES: readonly DatasetEdge[] = [
  { id: "e1", source: "person-anna", target: "company-techberlin", label: "CEO" },
  { id: "e2", source: "person-max", target: "company-spree", label: "Partner" },
  { id: "e3", source: "company-techberlin", target: "loc-mitte", label: "HQ" },
  { id: "e4", source: "company-spree", target: "loc-kreuzberg", label: "Office" },
  { id: "e5", source: "person-anna", target: "person-max", label: "Advisor" },
  { id: "e6", source: "loc-brandenburg", target: "loc-mitte", label: "Landmark" },
];

export const LAYOUT: Record<string, { x: number; y: number }> = {
  "company-techberlin": { x: 0, y: 0 },
  "company-spree": { x: 280, y: 40 },
  "person-anna": { x: -120, y: -80 },
  "person-max": { x: 420, y: -60 },
  "loc-brandenburg": { x: -80, y: 160 },
  "loc-alexanderplatz": { x: 120, y: 200 },
  "loc-mitte": { x: 40, y: 120 },
  "loc-kreuzberg": { x: 320, y: 180 },
};

export const MAP_SHAPES: readonly DatasetMapShape[] = [
  {
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
  },
  {
    id: "shape-kreuzberg",
    kind: "polygon",
    coordinates: [
      [
        [13.4, 52.49],
        [13.44, 52.49],
        [13.44, 52.47],
        [13.4, 52.47],
        [13.4, 52.49],
      ],
    ],
    label: "Kreuzberg",
  },
  {
    id: "shape-hq",
    kind: "point",
    coordinates: [13.405, 52.52],
    label: "TechBerlin HQ",
  },
];

export const SIGNALS: readonly Signal[] = [
  {
    id: "signal-1",
    coordinates: [13.3777, 52.5163],
    label: "Brandenburg Gate activity",
    strength: 0.82,
  },
  {
    id: "signal-2",
    coordinates: [13.4134, 52.5219],
    label: "Alexanderplatz traffic",
    strength: 0.67,
  },
  {
    id: "signal-3",
    coordinates: [13.405, 52.498],
    label: "Kreuzberg cluster",
    strength: 0.74,
  },
];

export interface SearchEntitiesFilter {
  query?: string;
  kinds?: string[];
  keyword?: string;
  city?: string;
}

export interface SearchEntitiesResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: Record<string, { x: number; y: number }>;
  entities: DatasetEntity[];
  matchCount: number;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function entityMatchesKeyword(entity: DatasetEntity, keyword: string): boolean {
  const normalized = normalizeToken(keyword);
  if (!normalized) {
    return true;
  }

  const haystack = `${entity.id} ${entity.label} ${entity.kind}`.toLowerCase();
  return haystack.includes(normalized);
}

export function searchEntities(filter: SearchEntitiesFilter = {}): SearchEntitiesResult {
  const kinds = filter.kinds?.map((kind) => normalizeToken(kind)).filter(Boolean);
  const keyword = filter.keyword ?? filter.query ?? "";
  const tokens = keyword
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 0 && token !== "berlin");

  let matched = ENTITIES.filter((entity) => {
    if (kinds && kinds.length > 0 && !kinds.includes(normalizeToken(entity.kind))) {
      return false;
    }

    if (tokens.length === 0) {
      return true;
    }

    return tokens.every((token) => entityMatchesKeyword(entity, token));
  });

  if (matched.length === 0 && kinds && kinds.length > 0) {
    matched = ENTITIES.filter((entity) => kinds.includes(normalizeToken(entity.kind)));
  }

  const nodeIds = new Set(matched.map((entity) => entity.id));
  const edges = EDGES.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  ).map((edge) => ({ ...edge }));

  const nodes: GraphNode[] = matched.map((entity) => ({
    id: entity.id,
    label: entity.label,
    kind: entity.kind,
  }));

  const layout: Record<string, { x: number; y: number }> = {};
  for (const entity of matched) {
    const position = LAYOUT[entity.id];
    if (position) {
      layout[entity.id] = { ...position };
    }
  }

  return {
    nodes,
    edges,
    layout,
    entities: [...matched],
    matchCount: matched.length,
  };
}

export function edgesForNodeIds(nodeIds: ReadonlySet<string>): GraphEdge[] {
  return EDGES.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map(
    (edge) => ({ ...edge }),
  );
}

export interface SelectSignalsFilter {
  area?: string;
  keyword?: string;
  signalIds?: string[];
}

export function selectSignals(filter: SelectSignalsFilter = {}): Signal[] {
  if (filter.signalIds && filter.signalIds.length > 0) {
    const ids = new Set(filter.signalIds);
    return SIGNALS.filter((signal) => ids.has(signal.id)).map((signal) => ({ ...signal }));
  }

  const areaToken = normalizeToken(filter.area ?? "");
  const keywordToken = normalizeToken(filter.keyword ?? "");

  return SIGNALS.filter((signal) => {
    const haystack = `${signal.id} ${signal.label}`.toLowerCase();
    if (areaToken && !haystack.includes(areaToken)) {
      return false;
    }
    if (keywordToken && !haystack.includes(keywordToken)) {
      return false;
    }
    return true;
  }).map((signal) => ({ ...signal }));
}
