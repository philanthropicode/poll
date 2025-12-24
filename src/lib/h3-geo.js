import { cellToBoundary } from "h3-js";

/** Convert [{h3, count?, sum}] to GeoJSON FeatureCollection with Polygon rings. */
export function h3AggToFeatureCollection(aggs) {
  return {
    type: "FeatureCollection",
    features: (aggs || []).map((a) => {
      const ring = cellToBoundary(a.h3, true) // [lng,lat]
        .map(([lng, lat]) => [lng, lat]);
      // ensure closed
      if (
        ring.length &&
        (ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1])
      ) {
        ring.push([ring[0][0], ring[0][1]]);
      }
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          h3index: a.h3,
          count: a.count ?? 0,
          sum: a.sum ?? 0,
        },
      };
    }),
  };
}

/** Compute [minLng, minLat, maxLng, maxLat] from a FeatureCollection of polygons. */
export function bboxFromFeatureCollection(fc) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const features = fc?.features || [];
  for (const f of features) {
    const coords = f?.geometry?.coordinates?.[0] || [];
    for (const [lng, lat] of coords) {
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  if (!features.length || !isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Get min/max of a metric ("sum" | "count") for a legend. */
export function domainFromAggs(aggs, metric = "sum") {
  if (!aggs?.length) return { min: 0, max: 1 };
  let min = Infinity, max = -Infinity;
  for (const a of aggs) {
    const v = Number(a?.[metric] ?? 0);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
  if (min === max) { min = Math.floor(min - 1); max = Math.ceil(max + 1); }
  return { min, max };
}
