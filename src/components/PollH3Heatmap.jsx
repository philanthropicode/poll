import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { LngLatBoundsLike, Map as MapboxMap } from "mapbox-gl";
import { geoToH3, h3ToGeoBoundary } from "h3-js";

// ---------- Types ----------
export type Question = { id: string; label: string };

export type H3Agg = {
  h3: string; // e.g., r8 index
  sum: number; // sum of responses for the selected question
};

export type FetchAggsFn = (args: {
  pollId: string;
  questionId: string;
  bounds: { west: number; south: number; east: number; north: number };
  resolution: number; // h3 resolution, default 8
}) => Promise<H3Agg[]>;

interface Props {
  pollId: string;
  mapboxToken: string;
  questions: Question[];
  defaultQuestionId?: string;
  resolution?: number; // default 8 (h3r8)
  fetchAggs: FetchAggsFn; // caller-provided data loader (Firestore/HTTP/etc.)
  className?: string;
}

// ---------- Utilities ----------
function boundsFromMap(map: MapboxMap) {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

function makeHexFeature(h3Index: string, value: number) {
  const boundary = h3ToGeoBoundary(h3Index, true) as [number, number][]; // [lng, lat]
  const coordinates = [boundary.concat([boundary[0]])]; // close the ring
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coordinates[0].map(([lng, lat]) => [lng, lat])] },
    properties: { h3: h3Index, value },
  };
}

function toGeoJSON(aggs: H3Agg[]) {
  return {
    type: "FeatureCollection" as const,
    features: aggs.map((a) => makeHexFeature(a.h3, a.sum)),
  };
}

function computeDomain(aggs: H3Agg[]) {
  if (aggs.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const a of aggs) {
    if (a.sum < min) min = a.sum;
    if (a.sum > max) max = a.sum;
  }
  if (min === max) {
    // widen a touch so color scale interpolates
    min = Math.floor(min - 1);
    max = Math.ceil(max + 1);
  }
  return { min, max };
}

// A small diverging palette (cool -> warm). Feel free to swap for your design tokens.
const PALETTE = [
  "#2c7bb6",
  "#abd9e9",
  "#ffffbf",
  "#fdae61",
  "#d7191c",
];

function buildColorExpression(min: number, max: number) {
  // Mapbox expression: interpolate linearly from min..max over palette stops
  const stops = [
    min,
    PALETTE[0],
    min + (max - min) * 0.25,
    PALETTE[1],
    min + (max - min) * 0.5,
    PALETTE[2],
    min + (max - min) * 0.75,
    PALETTE[3],
    max,
    PALETTE[4],
  ];
  return ["interpolate", ["linear"], ["get", "value"], ...stops] as any;
}

// ---------- Component ----------
export default function PollH3Heatmap({
  pollId,
  mapboxToken,
  questions,
  defaultQuestionId,
  resolution = 8,
  fetchAggs,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [selectedQ, setSelectedQ] = useState<string>(defaultQuestionId || questions[0]?.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aggs, setAggs] = useState<H3Agg[]>([]);
  const domain = useMemo(() => computeDomain(aggs), [aggs]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-95.9, 37.5],
      zoom: 3.2,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    map.on("load", () => {
      // empty source on load; we'll update after fetch
      map.addSource("h3-aggs", { type: "geojson", data: toGeoJSON([]) });
      map.addLayer({
        id: "h3-fill",
        type: "fill",
        source: "h3-aggs",
        paint: {
          "fill-color": buildColorExpression(domain.min, domain.max),
          "fill-opacity": 0.75,
          "fill-outline-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "h3-outline",
        type: "line",
        source: "h3-aggs",
        paint: { "line-color": "#ffffff", "line-width": 0.25, "line-opacity": 0.6 },
      });

      // First load
      void refreshAggs(map);
    });

    // Refresh on view changes (debounced)
    let t: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (map.isStyleLoaded()) void refreshAggs(map);
      }, 250);
    };

    map.on("moveend", schedule);
    mapRef.current = map;
    return () => {
      map.off("moveend", schedule);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // Update color scale when domain changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer("h3-fill")) return;
    map.setPaintProperty("h3-fill", "fill-color", buildColorExpression(domain.min, domain.max));
  }, [domain.min, domain.max]);

  // Fetch when selected question changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;
    void refreshAggs(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQ, resolution]);

  async function refreshAggs(map: MapboxMap) {
    if (!selectedQ) return;
    setLoading(true);
    setError(null);
    try {
      const b = boundsFromMap(map);
      const result = await fetchAggs({ pollId, questionId: selectedQ, bounds: b, resolution });
      setAggs(result);

      const source = map.getSource("h3-aggs") as mapboxgl.GeoJSONSource;
      source.setData(toGeoJSON(result));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={"w-full h-full flex flex-col gap-3 " + (className || "")}> 
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex flex-wrap gap-3 items-center">
          <legend className="text-sm font-medium text-gray-700">Select question</legend>
          {questions.map((q) => (
            <label key={q.id} className="inline-flex items-center gap-2 text-sm bg-white border rounded-full px-3 py-1 shadow-sm hover:shadow">
              <input
                type="radio"
                name="question"
                value={q.id}
                checked={selectedQ === q.id}
                onChange={(e) => setSelectedQ(e.target.value)}
              />
              <span>{q.label}</span>
            </label>
          ))}
        </fieldset>
        <span className="ml-auto text-xs text-gray-500">
          {loading ? "Updating map…" : error ? `Error: ${error}` : `${aggs.length} hexes`}
        </span>
      </div>

      {/* Map */}
      <div ref={containerRef} className="relative w-full grow min-h-[420px] rounded-2xl overflow-hidden shadow" />

      {/* Legend */}
      <Legend min={domain.min} max={domain.max} />
    </div>
  );
}

function Legend({ min, max }: { min: number; max: number }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <span className="text-xs text-gray-600 justify-self-end col-span-1">{min}</span>
      <div className="col-span-10 h-2 rounded-full" style={{
        background: `linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[1]}, ${PALETTE[2]}, ${PALETTE[3]}, ${PALETTE[4]})`,
      }} />
      <span className="text-xs text-gray-600 col-span-1">{max}</span>
    </div>
  );
}

// ---------- Example fetchAggs implementation (Firestore/HTTP) ----------
// NOTE: Replace with your actual data source. For scale, pre-aggregate in Cloud Functions.
// This example assumes a REST endpoint like: `/api/polls/:pollId/h3Agg?questionId=...&west=...&south=...&east=...&north=...&res=8`
// returning: { aggs: Array<{h3: string, sum: number}> }
export async function exampleFetchAggs({ pollId, questionId, bounds, resolution }: Parameters<FetchAggsFn>[0]): Promise<H3Agg[]> {
  const params = new URLSearchParams({
    questionId,
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
    res: String(resolution),
  });
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/h3Agg?` + params.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.aggs as H3Agg[];
}

// ---------- Usage ----------
// <PollH3Heatmap
//   pollId={pollId}
//   mapboxToken={process.env.MAPBOX_TOKEN!}
//   questions={questionsFromPoll}
//   defaultQuestionId={questionsFromPoll[1]?.id}
//   resolution={8}
//   fetchAggs={exampleFetchAggs}
// />
