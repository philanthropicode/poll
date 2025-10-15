// src/components/PollH3Heatmap.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cellToBoundary } from "h3-js";
import { getH3AggCallable } from "../lib/callables";

// Simple object types (JSDoc for editor hints)
/**
 * @typedef {{ h3: string, sum: number }} H3Agg
 */

/**
 * @typedef {(args: {
 *   pollId: string;
 *   questionId: string;
 *   bounds: { west: number; south: number; east: number; north: number };
 *   resolution: number;
 * }) => Promise<H3Agg[]>} FetchAggsFn
 */

/**
 * @param {{
 *  pollId: string;
 *  mapboxToken: string;
 *  questions: Array<{ id: string; label: string }>;
 *  defaultQuestionId?: string;
 *  resolution?: number;
 *  fetchAggs: FetchAggsFn;
 *  className?: string;
 * }} props
 */
export default function PollH3Heatmap({
  pollId,
  mapboxToken,
  questions,
  defaultQuestionId,
  resolution = 8,
  fetchAggs,
  className,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedQ, setSelectedQ] = useState(defaultQuestionId || questions[0]?.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aggs, setAggs] = useState([]);

  function boundsFromMap(map) {
    if (!map?.isStyleLoaded?.()) return null;
    const b = map.getBounds?.();
    if (!b) return null;
    const west = b.getWest?.(); const south = b.getSouth?.();
    const east = b.getEast?.(); const north = b.getNorth?.();
    if ([west, south, east, north].every(Number.isFinite)) {
      return { west, south, east, north };
    }
    return null;
  }

  function makeHexFeature(h3Index, value) {
    const boundary = cellToBoundary(h3Index, true); // [lng, lat] pairs
    const ring = boundary.concat([boundary[0]]);    // close polygon
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring.map(([lng, lat]) => [lng, lat])] },
      properties: { h3: h3Index, value },
    };
  }

  function toGeoJSON(list) {
    return { type: "FeatureCollection", features: list.map((a) => makeHexFeature(a.h3, a.sum)) };
  }

  function computeDomain(list) {
    if (!list.length) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    for (const a of list) { if (a.sum < min) min = a.sum; if (a.sum > max) max = a.sum; }
    if (min === max) { min = Math.floor(min - 1); max = Math.ceil(max + 1); }
    return { min, max };
  }

  const PALETTE = ["#2c7bb6","#abd9e9","#ffffbf","#fdae61","#d7191c"];

  function buildColorExpression(min, max) {
    return [
      "interpolate", ["linear"], ["get", "value"],
      min, PALETTE[0],
      min + (max - min) * 0.25, PALETTE[1],
      min + (max - min) * 0.5,  PALETTE[2],
      min + (max - min) * 0.75, PALETTE[3],
      max, PALETTE[4],
    ];
  }

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
      void refreshAggs(map);
    });

    // Debounced refresh on move end
    let t = null;
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

  // Fetch when selected question/resolution changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    void refreshAggs(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQ, resolution]);

  async function refreshAggs(map) {
    if (!selectedQ) return;
    setLoading(true);
    setError(null);
    try {
      const b = boundsFromMap(map);
      const result = await fetchAggs({
        pollId,
        questionId: selectedQ,
        bounds: b || undefined, // let exampleFetchAggs decide
        resolution
      });
      setAggs(result);
      const source = map.getSource("h3-aggs");
      if (source) source.setData(toGeoJSON(result));
    } catch (e) {
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
      <div
        ref={containerRef}
        className="relative z-0 w-full grow min-h-[420px] rounded-2xl overflow-hidden shadow"
      />

      {/* Legend */}
      <Legend min={domain.min} max={domain.max} />
    </div>
  );
}

function Legend({ min, max }) {
  const PALETTE = ["#2c7bb6","#abd9e9","#ffffbf","#fdae61","#d7191c"];
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <span className="text-xs text-gray-600 justify-self-end col-span-1">{min}</span>
      <div
        className="col-span-10 h-2 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[1]}, ${PALETTE[2]}, ${PALETTE[3]}, ${PALETTE[4]})`,
        }}
      />
      <span className="text-xs text-gray-600 col-span-1">{max}</span>
    </div>
  );
}

// Example fetchAggs implementation (HTTP)
// GET /api/polls/:pollId/h3Agg?questionId=...&west=...&south=...&east=...&north=...&res=8
// export async function exampleFetchAggs({ pollId, questionId, bounds, resolution }) {
//   const { data } = await getH3AggCallable({
//     pollId,
//     questionId,
//     res: resolution,
//     west: bounds.west,
//     south: bounds.south,
//     east: bounds.east,
//     north: bounds.north,
//   });
//   return (data && data.aggs) ? data.aggs : [];
// }
export async function exampleFetchAggs({ pollId, questionId, bounds, resolution }) {
  // Only pass bounds if every edge is a finite number and the rectangle is valid.
  const finite =
    bounds &&
    [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite) &&
    bounds.west < bounds.east &&
    bounds.south < bounds.north;

  const payload = finite
    ? {
        pollId,
        questionId,
        res: resolution,
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
      }
    : { pollId, questionId, res: resolution }; // no bounds → safe “return all” path

  const { data } = await getH3AggCallable(payload);
  return (data && data.aggs) ? data.aggs : [];
}

