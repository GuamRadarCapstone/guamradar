import { polygon as turfPolygon, featureCollection } from "@turf/helpers";
import intersect from "@turf/intersect";
import type { Village } from "../types/data";

/** Correct OSM names to official guam.gov village names */
const VILLAGE_NAME_FIXES: Record<string, string> = {
  "Agana Heights": "Agaña Heights",
  "Asan": "Asan-Maina",
  "Tamuning": "Tamuning-Tumon-Harmon",
};

export function normalizeVillageId(name: string) {
  return name
    .replace(/\bMunicipality\b/gi, "")
    .replace(/['']/g, "")
    .replace(/[åÅ]/g, "a")
    .replace(/[áàâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** Keep GeoJSON [lng, lat] order */
function toRingGeoJson(coords: any[]): [number, number][] {
  return coords.map(([lng, lat]: [number, number]) => [lng, lat]);
}

function ringBBox(ring: [number, number][]) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLat, minLng, maxLat, maxLng };
}

function bboxIntersectionArea(a: ReturnType<typeof ringBBox>, b: typeof GUAM_MAIN_BB) {
  const x1 = Math.max(a.minLng, b.minLng);
  const y1 = Math.max(a.minLat, b.minLat);
  const x2 = Math.min(a.maxLng, b.maxLng);
  const y2 = Math.min(a.maxLat, b.maxLat);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

function bboxArea(bb: ReturnType<typeof ringBBox>) {
  return Math.max(0, bb.maxLng - bb.minLng) * Math.max(0, bb.maxLat - bb.minLat);
}

const GUAM_MAIN_BB = { minLat: 13.2, maxLat: 13.75, minLng: 144.6, maxLng: 144.98 };

/** Ensure a ring is closed (first point === last point) */
function ensureClosed(ring: [number, number][]): [number, number][] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, first];
  }
  return ring;
}

/**
 * Clip a village ring against the Guam coastline polygon.
 * Returns the clipped ring, or the original ring if clipping fails.
 */
function clipToCoastline(
  villageRing: [number, number][],
  coastlinePoly: ReturnType<typeof turfPolygon>,
): [number, number][] {
  try {
    const villagePoly = turfPolygon([ensureClosed(villageRing)]);
    const result = intersect(featureCollection([coastlinePoly, villagePoly]));

    if (!result) return villageRing;

    const geom = result.geometry;

    if (geom.type === "Polygon") {
      return geom.coordinates[0] as [number, number][];
    }

    if (geom.type === "MultiPolygon") {
      // Pick the polygon with the most overlap with Guam's main island
      let best = geom.coordinates[0][0] as [number, number][];
      let bestOverlap = -1;
      let bestArea = -1;

      for (const poly of geom.coordinates) {
        const ring = poly[0] as [number, number][];
        const bb = ringBBox(ring);
        const overlap = bboxIntersectionArea(bb, GUAM_MAIN_BB);
        const area = bboxArea(bb);
        if (overlap > bestOverlap || (overlap === bestOverlap && area > bestArea)) {
          bestOverlap = overlap;
          bestArea = area;
          best = ring;
        }
      }
      return best;
    }

    return villageRing;
  } catch {
    return villageRing;
  }
}

export function geoJsonToVillages(geo: any): Village[] {
  const features = geo?.features ?? [];

  // Extract the Guam coastline polygon for clipping
  let coastlinePoly: ReturnType<typeof turfPolygon> | null = null;
  for (const f of features) {
    if (f?.properties?.name === "Guam" && f?.geometry?.type === "Polygon") {
      const outerRing = f.geometry.coordinates?.[0];
      if (outerRing?.length) {
        try {
          coastlinePoly = turfPolygon([ensureClosed(toRingGeoJson(outerRing))]);
        } catch { /* fall back to unclipped */ }
      }
      break;
    }
  }

  return features
    .map((f: any) => {
      const rawName = f?.properties?.name;
      const geom = f?.geometry;
      if (!rawName || !geom) return null;
      if (rawName === "Guam" || rawName === "United States") return null;

      const id = normalizeVillageId(rawName);
      const stripped = rawName.replace(/\bMunicipality\b/gi, "").trim();
      const cleanName = VILLAGE_NAME_FIXES[stripped] ?? stripped;

      const candidateRings: [number, number][][] = [];

      if (geom.type === "Polygon") {
        const outer = geom.coordinates?.[0];
        if (outer?.length) candidateRings.push(toRingGeoJson(outer));
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates ?? []) {
          const outer = poly?.[0];
          if (outer?.length) candidateRings.push(toRingGeoJson(outer));
        }
      } else {
        return null;
      }

      if (!candidateRings.length) return null;

      let best = candidateRings[0];
      let bestOverlap = -1;
      let bestArea = -1;

      for (const ring of candidateRings) {
        const bb = ringBBox(ring);
        const overlap = bboxIntersectionArea(bb, GUAM_MAIN_BB);
        const area = bboxArea(bb);
        if (overlap > bestOverlap || (overlap === bestOverlap && area > bestArea)) {
          bestOverlap = overlap;
          bestArea = area;
          best = ring;
        }
      }

      // Clip the best ring to the coastline
      if (coastlinePoly) {
        best = clipToCoastline(best, coastlinePoly);
      }

      return { id, name: cleanName, polygon: best };
    })
    .filter(Boolean) as Village[];
}

/** Ray-casting point-in-polygon. ring is [[lng,lat], ...] (GeoJSON order) */
export function pointInRing(lat: number, lng: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][1]; // lat
    const xi = ring[i][0]; // lng
    const yj = ring[j][1];
    const xj = ring[j][0];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findVillageForPoint(villages: Village[], lat: number, lng: number): Village | null {
  for (const v of villages) {
    if (pointInRing(lat, lng, v.polygon)) return v;
  }
  return null;
}
