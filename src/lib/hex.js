import * as h3 from "h3-js";

// Random points inside a bbox [minLon,minLat,maxLon,maxLat]
export function randomPointsInBbox(bbox, n) {
  const [minX, minY, maxX, maxY] = bbox;
  return Array.from({ length: n }, () => ({
    lon: minX + Math.random() * (maxX - minX),
    lat: minY + Math.random() * (maxY - minY),
    weight: 1 + Math.random() * 5 // dummy metric
  }));
}

// Aggregate points into H3 bins at a resolution
export function aggregateToH3(
  points,
  res
) {
  const bins = new Map();
  for (const p of points) {
    const idx = h3.latLngToCell(p.lat, p.lon, res);
    const prev = bins.get(idx) ?? { count: 0, sum: 0 };
    bins.set(idx, { count: prev.count + 1, sum: prev.sum + (p.weight ?? 1) });
  }
  return Array.from(bins, ([h3index, stats]) => ({ h3index, ...stats }));
}

// Turn H3 indices into a GeoJSON FeatureCollection (polygons with props)
export function h3AggToFeatureCollection(
  agg
) {
  const features = agg.map(({ h3index, count, sum }) => {
    // H3 returns [lat, lon]; GeoJSON needs [lon, lat]
    const ring = h3
      .cellToBoundary(h3index, true)
      .map(([lon, lat]) => [lon, lat]); // <-- correct order

    // Ensure ring is closed
    if (
      ring.length &&
      (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push([ring[0][0], ring[0][1]]);
    }

    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { h3index, count, sum }
    };
  });

  return { type: "FeatureCollection", features };
}