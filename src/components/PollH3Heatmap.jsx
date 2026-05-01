// src/components/PollH3Heatmap.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cellToBoundary } from "h3-js";
import "./map.css";

const PALETTE = ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"];

function buildColorExpression(min, max) {
  return [
    "interpolate",
    ["linear"],
    ["get", "value"],
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
}

function boundsFromMap(map) {
  if (!map?.isStyleLoaded?.()) return null;
  const b = map.getBounds?.();
  if (!b) return null;
  const west = b.getWest?.();
  const south = b.getSouth?.();
  const east = b.getEast?.();
  const north = b.getNorth?.();
  if ([west, south, east, north].every(Number.isFinite)) {
    return { west, south, east, north };
  }
  return null;
}

function makeHexFeature(h3Index, value) {
  const boundary = cellToBoundary(h3Index, true);
  const ring = boundary.concat([boundary[0]]);
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
  let min = Infinity;
  let max = -Infinity;
  for (const a of list) {
    if (a.sum < min) min = a.sum;
    if (a.sum > max) max = a.sum;
  }
  if (min === max) {
    min = Math.floor(min - 1);
    max = Math.ceil(max + 1);
  }
  return { min, max };
}

// Map a Mapbox zoom level to one of the three pre-computed H3 resolutions
// (r7/r8/r9). Wide views need coarser cells so hexes stay visible at the
// rendered pixel size; tight zooms benefit from finer granularity.
function resolutionForZoom(zoom, fallback = 8) {
  if (!Number.isFinite(zoom)) return fallback;
  if (zoom < 7) return 7;
  if (zoom < 12) return 8;
  return 9;
}

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
  const didInitialFitRef = useRef(false);
  const [selectedQ, setSelectedQ] = useState(defaultQuestionId || questions[0]?.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aggs, setAggs] = useState([]);

  const domain = useMemo(() => computeDomain(aggs), [aggs]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxToken) return;
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
      if (t) clearTimeout(t);
      map.off("moveend", schedule);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("h3-fill")) return;
    map.setPaintProperty("h3-fill", "fill-color", buildColorExpression(domain.min, domain.max));
  }, [domain.min, domain.max]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    void refreshAggs(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQ, resolution]);

  async function refreshAggs(map) {
    if (!selectedQ) return;
    if (!map || !map.isStyleLoaded()) return;
    setLoading(true);
    setError(null);
    try {
      const bounds = boundsFromMap(map);
      // Pick the resolution that fits the current zoom so cells render at a
      // visible size whether the user is looking at one neighborhood or the
      // whole country. The `resolution` prop is the fallback if zoom is unknown.
      const effectiveResolution = resolutionForZoom(map.getZoom?.(), resolution);
      // Backend rejects bounds outside [0.00001, maxArea] for the requested resolution.
      const maxArea = effectiveResolution >= 8 ? 25 : effectiveResolution >= 7 ? 100 : 400;
      const area = bounds
        ? Math.abs((bounds.east - bounds.west) * (bounds.north - bounds.south))
        : Infinity;
      const sendBounds = bounds && area >= 0.00001 && area <= maxArea;

      const result = await fetchAggs({
        pollId,
        questionId: selectedQ,
        bounds: sendBounds ? bounds : undefined,
        resolution: effectiveResolution,
      });
      setAggs(result);
      const source = map.getSource("h3-aggs");
      if (source) source.setData(toGeoJSON(result));

      // First successful load without bounds: fit the map to the data so the user sees it.
      if (!didInitialFitRef.current && !sendBounds && result.length > 0) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const a of result) {
          for (const [lng, lat] of cellToBoundary(a.h3, true)) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
        if (Number.isFinite(minLng)) {
          didInitialFitRef.current = true;
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, animate: true, duration: 800, maxZoom: 11 },
          );
        }
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`w-full h-full flex flex-col gap-3 ${className || ""}`}>
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

      <div className="relative z-0 w-full grow min-h-[420px] rounded-2xl overflow-hidden shadow">
        {!loading && !error && aggs.length === 0 && (
          <div className="absolute z-10 m-3 p-3 text-sm bg-white/95 rounded-lg border shadow-sm max-w-xs">
            <div className="font-medium text-gray-800 mb-1">No map data available</div>
            <div className="text-xs text-gray-600">
              This could mean no submissions exist yet, or location data hasn’t been collected.
            </div>
          </div>
        )}
        {!mapboxToken && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-red-600">
            Mapbox token is required to render the heatmap.
          </div>
        )}
        <div ref={containerRef} className="map-container w-full h-full" />
      </div>

      <Legend min={domain.min} max={domain.max} />
    </div>
  );
}

function Legend({ min, max }) {
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
