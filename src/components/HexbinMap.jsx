import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Props:
 * - accessToken:           string  (required)
 * - styleUrl:              string  (Mapbox style URL; default light-v11)
 * - containerStyle:        React.CSSProperties (size & shape; default: {width:'100%',height:420})
 *
 * Data props (pick one of the first two):
 * - hexAgg:                Array<{ h3index: string; count: number; sum: number }>
 * - hexFeatureCollection:  GeoJSON FeatureCollection (Polygon features with props {h3index,count,sum})
 * - debugPoints:           Array<{ lon: number; lat: number }> (optional; draws tiny red dots)
 *
 * Color/metric:
 * - metric:                "count" | "sum"                 (controlled; default "count")
 * - onMetricChange:        (m) => void                     (optional for controlled UI)
 *
 * H3 resolution (optional; only used if you render the optional controls or want to show it):
 * - resolution:            number                           (controlled; e.g. 7)
 * - onResolutionChange:    (r:number) => void
 *
 * Viewport (choose ONE of these patterns):
 * - bbox:                  [minLon, minLat, maxLon, maxLat] (autoFit on load & on change)
 * - centerZoom:            { center:[lon,lat], zoom:number } (direct set; no fit)
 * - autoFit:               boolean                          (default true if bbox is provided)
 * - fitPadding:            number | {top:number,right:number,bottom:number,left:number} (default 40)
 *
 * Layer toggles:
 * - showControls:          boolean (default false)          (renders overlay sliders/select)
 * - showHexOutline:        boolean (default true)
 * - showDebugPoints:       boolean (default false; requires debugPoints)
 *
 * Map options:
 * - mapOptions:            Partial<mapboxgl.MapboxOptions>  (bearing, pitch, etc.)
 */
export default function HexbinMap({
  accessToken,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  containerStyle = { width: "100%", height: 420, borderRadius: 12, overflow: "hidden" },

  // data:
  hexAgg,
  hexFeatureCollection,
  debugPoints = [],

  // metric / resolution (controlled-ish):
  metric: metricProp,
  onMetricChange,
  resolution: resolutionProp,
  onResolutionChange,

  // viewport:
  bbox,
  centerZoom,
  autoFit: autoFitProp,
  fitPadding = 40,

  // toggles:
  showControls = false,
  showHexOutline = true,
  showDebugPoints = false,

  // opacity:
  hexOpacity = 0.5,

  // map options (bearing, pitch, dragPan, etc.)
  mapOptions = {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef/** @type {mapboxgl.Map | null} */(null);
  const loadedRef = useRef(false);

  // Uncontrolled fallbacks
  const [metricInternal, setMetricInternal] = useState("count");
  const [resolutionInternal, setResolutionInternal] = useState(7);

  const metric = metricProp ?? metricInternal;
  const setMetric = onMetricChange ?? setMetricInternal;

  const resolution = resolutionProp ?? resolutionInternal;
  const setResolution = onResolutionChange ?? setResolutionInternal;

  // Access token
  useEffect(() => {
    if (accessToken) mapboxgl.accessToken = accessToken;
  }, [accessToken]);

  // Normalize hex data into a FeatureCollection if needed
  const hexFC = useMemo(() => {
    if (hexFeatureCollection) return hexFeatureCollection;
    if (hexAgg) {
      return {
        type: "FeatureCollection",
        features: hexAgg.map(({ h3index, count, sum }) => ({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: /* placeholder */ [[]] },
          properties: { h3index, count, sum },
        })),
      };
    }
    return { type: "FeatureCollection", features: [] };
  }, [hexAgg, hexFeatureCollection]);

  // If hexAgg is provided, we still need actual coordinates.
  // Expect upstream to supply proper polygons OR you can import your helper (h3AggToFeatureCollection).
  // Here we simply pass through as-is; if hexAgg is used, make sure you pre-convert outside.

  // Compute metric max for color ramp
  const maxVal = useMemo(() => {
    let m = 1;
    for (const f of hexFC.features) {
      const v = f.properties?.[metric] ?? 0;
      if (v > m) m = v;
    }
    return m;
  }, [hexFC, metric]);

  const ramp = useMemo(
    () => [
      "step",
      ["get", metric],
      "#fff7ec",
      (maxVal / 6) * 1,
      "#fee8c8",
      (maxVal / 6) * 2,
      "#fdd49e",
      (maxVal / 6) * 3,
      "#fdbb84",
      (maxVal / 6) * 4,
      "#fc8d59",
      (maxVal / 6) * 5,
      "#d7301f",
    ],
    [metric, maxVal]
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      attributionControl: true,
      ...centerZoom,
      ...mapOptions,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      loadedRef.current = true;

      // sources
      map.addSource("hexes", { type: "geojson", data: hexFC });
      if (showDebugPoints) {
        map.addSource("pts", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: debugPoints.map((p) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lon, p.lat] },
              properties: {},
            })),
          },
        });
      }

      // layers
      map.addLayer({
        id: "hex-fill",
        type: "fill",
        source: "hexes",
        paint: { "fill-color": ramp, "fill-opacity": hexOpacity },
      });

      if (showHexOutline) {
        map.addLayer({
          id: "hex-outline",
          type: "line",
          source: "hexes",
          paint: { "line-color": "#111", "line-width": 1.25, "line-opacity": 0.95 },
        });
      }

      if (showDebugPoints && map.getSource("pts")) {
        map.addLayer({
          id: "pts-circle",
          type: "circle",
          source: "pts",
          paint: { "circle-radius": 2.5, "circle-color": "#e63946", "circle-opacity": 0.8 },
        });
      }

      // Popup on click
      map.on("click", (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["hex-fill"] })[0];
        if (!f) return;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:13px system-ui;">
               <div><b>h3</b>: ${f.properties.h3index}</div>
               <div><b>count</b>: ${f.properties.count}</div>
               <div><b>sum</b>: ${f.properties.sum}</div>
             </div>`
          )
          .addTo(map);
      });

      // initial viewport
      const autoFit =
        typeof autoFitProp === "boolean" ? autoFitProp : Array.isArray(bbox) && bbox.length === 4;

      if (autoFit && bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: fitPadding }
        );
      } else if (centerZoom?.center && typeof centerZoom?.zoom === "number") {
        map.setCenter(centerZoom.center);
        map.setZoom(centerZoom.zoom);
      } else if (hexFC.features.length > 0) {
        // Auto-fit to hex data if no explicit viewport is provided
        const bounds = new mapboxgl.LngLatBounds();
        hexFC.features.forEach(feature => {
          if (feature.geometry.type === "Polygon" && feature.geometry.coordinates[0]) {
            feature.geometry.coordinates[0].forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2) {
                bounds.extend(coord);
              }
            });
          }
        });
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: fitPadding });
        }
      }
    });

    // resize map on container size changes
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      try {
        map.remove();
      } catch {}
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update data + styling live
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("hexes");
    if (src && "setData" in src) {
      // ensure opacity/color are up to date too
      src.setData(hexFC);
      map.setPaintProperty("hex-fill", "fill-color", ramp);
      map.setPaintProperty("hex-fill", "fill-opacity", hexOpacity);
      
      // Auto-fit to new hex data if no explicit viewport control is active
      if (!bbox && !centerZoom && hexFC.features.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        hexFC.features.forEach(feature => {
          if (feature.geometry.type === "Polygon" && feature.geometry.coordinates[0]) {
            feature.geometry.coordinates[0].forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2) {
                bounds.extend(coord);
              }
            });
          }
        });
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: fitPadding });
        }
      }
    }
  }, [hexFC, ramp, hexOpacity, bbox, centerZoom, fitPadding]);

  // update debug points when provided
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !showDebugPoints) return;
    const src = map.getSource("pts");
    if (src && "setData" in src) {
      src.setData({
        type: "FeatureCollection",
        features: debugPoints.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lon, p.lat] },
          properties: {},
        })),
      });
    }
  }, [debugPoints, showDebugPoints]);

  // respond to bbox or centerZoom changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const autoFit =
      typeof autoFitProp === "boolean" ? autoFitProp : Array.isArray(bbox) && bbox.length === 4;

    if (autoFit && bbox) {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: fitPadding }
      );
    } else if (centerZoom?.center && typeof centerZoom?.zoom === "number") {
      map.setCenter(centerZoom.center);
      map.setZoom(centerZoom.zoom);
    }
  }, [bbox, centerZoom, autoFitProp, fitPadding]);

  return (
    <div style={{ position: "relative", ...containerStyle }}>
      {showControls && (
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            top: 8,
            left: 8,
            background: "rgba(255,255,255,.9)",
            padding: 8,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
            font: "14px/1.2 system-ui, sans-serif",
          }}
        >
          <label style={{ display: "block", margin: "6px 0" }}>
            Metric:&nbsp;
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="count">count</option>
              <option value="sum">sum</option>
            </select>
          </label>

          <label style={{ display: "block", margin: "6px 0" }}>
            H3 resolution: {resolution}
          </label>
          <input
            type="range"
            min={4}
            max={10}
            value={resolution}
            onChange={(e) => setResolution(parseInt(e.target.value, 10))}
            style={{ width: 220 }}
          />
        </div>
      )}

      <div
        ref={containerRef}
        id="hexbin-map-canvas"
        style={{ position: "absolute", inset: 0 }}
        aria-label="Hexbin map"
      />
    </div>
  );
}