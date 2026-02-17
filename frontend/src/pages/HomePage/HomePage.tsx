import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import styles from "./HomePage.module.css";
import { EVENTS, LIVE, PLACES, type EventItem, type Place, type Village } from "./demoData";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

/* ===================== VILLAGES (GeoJSON -> Mapbox) ===================== */

function normalizeVillageId(name: string) {
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

/** Keep GeoJSON [lng, lat] order — no flip needed for Mapbox */
function toRingGeoJson(coords: any[]): [number, number][] {
  return coords.map(([lng, lat]: [number, number]) => [lng, lat]);
}

function ringBBox(ring: [number, number][]) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLat, minLng, maxLat, maxLng };
}

function bboxIntersectionArea(a: any, b: any) {
  const x1 = Math.max(a.minLng, b.minLng);
  const y1 = Math.max(a.minLat, b.minLat);
  const x2 = Math.min(a.maxLng, b.maxLng);
  const y2 = Math.min(a.maxLat, b.maxLat);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

function bboxArea(bb: any) {
  const w = bb.maxLng - bb.minLng;
  const h = bb.maxLat - bb.minLat;
  return Math.max(0, w) * Math.max(0, h);
}

/** Correct OSM names to official guam.gov village names */
const VILLAGE_NAME_FIXES: Record<string, string> = {
  "Agana Heights": "Agaña Heights",
  "Asan": "Asan-Maina",
  "Tamuning": "Tamuning-Tumon-Harmon",
};

function geoJsonToVillages(geo: any): Village[] {
  const features = geo?.features ?? [];

  const GUAM_MAIN_BB = {
    minLat: 13.2,
    maxLat: 13.75,
    minLng: 144.6,
    maxLng: 144.98,
  };

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

      return { id, name: cleanName, polygon: best };
    })
    .filter(Boolean) as Village[];
}

// Ray-casting point-in-polygon.
// ring is [[lng,lat], ...] (GeoJSON order)
function pointInRing(lat: number, lng: number, ring: [number, number][]) {
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

function findVillageForPoint(villages: Village[], lat: number, lng: number): Village | null {
  for (const v of villages) {
    if (pointInRing(lat, lng, v.polygon)) return v;
  }
  return null;
}

/* ===================== TYPES ===================== */

type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type Selected = { kind: "PLACE"; id: string } | { kind: "EVENT"; id: string } | null;

/* ===================== CONSTANTS ===================== */

const DEFAULT_CENTER: { lng: number; lat: number } = { lng: 144.78, lat: 13.45 };
const DEFAULT_ZOOM = 10.8;

/* ===================== MUSIC (background) ===================== */
const MUSIC_FILE = "Freddy.mp3";

/* ===================== HELPERS ===================== */

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mockOpenNow(place: Place) {
  const h = (place.hours || "").toLowerCase();
  if (h.includes("24/7")) return true;
  if (h.includes("open daily")) return true;
  let x = 0;
  for (let i = 0; i < place.id.length; i++) x = (x * 31 + place.id.charCodeAt(i)) | 0;
  return (x & 1) === 0;
}

/* ===================== MAPBOX HELPERS ===================== */

function placeEmoji(type: Place["type"]) {
  if (type === "RESTAURANT") return "🍴";
  if (type === "HOTEL") return "🏨";
  return "📍";
}

function eventEmoji(status: EventItem["status"]) {
  return status === "VERIFIED" ? "📅" : "🕓";
}

/** Generate a GeoJSON polygon ring approximating a circle */
function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 64,
): [number, number][] {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (km / 6371) * (180 / Math.PI) * Math.cos(angle);
    const dLng =
      ((km / 6371) * (180 / Math.PI) * Math.sin(angle)) /
      Math.cos((centerLat * Math.PI) / 180);
    coords.push([centerLng + dLng, centerLat + dLat]);
  }
  return coords;
}

function EmojiPin({
  emoji,
  border,
  bg,
}: {
  emoji: string;
  border: string;
  bg: string;
}) {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${border}`,
        background: bg,
        boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
        fontSize: 16,
        cursor: "pointer",
      }}
    >
      {emoji}
    </div>
  );
}

/* ===================== POPUP STATE TYPE ===================== */

type PopupInfo =
  | { kind: "VILLAGE"; village: Village; lng: number; lat: number }
  | { kind: "PLACE"; place: Place }
  | { kind: "EVENT"; event: EventItem }
  | { kind: "USER"; lng: number; lat: number; acc: number | null }
  | { kind: "LIVE"; hotspot: (typeof LIVE)[number] }
  | null;

/* ===================== PAGE ===================== */

export function HomePage() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("ALL");
  const [search, setSearch] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  const [showPOI, setShowPOI] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showLive, setShowLive] = useState(false);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [userAcc, setUserAcc] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [popupInfo, setPopupInfo] = useState<PopupInfo>(null);
  const [cursor, setCursor] = useState<string>("");

  const [detailsOpen, setDetailsOpen] = useState(true);
  const [villageOpen, setVillageOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");

  /* ===================== MUSIC STATE ===================== */
  const [musicOn, setMusicOn] = useState(false);
  const [showVillages, setShowVillages] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(`${import.meta.env.BASE_URL}${MUSIC_FILE}`);
    a.loop = true;
    a.volume = 0.25;
    audioRef.current = a;

    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  const toggleMusic = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (musicOn) {
      a.pause();
      setMusicOn(false);
    } else {
      try {
        await a.play();
        setMusicOn(true);
      } catch {
        // autoplay blocked until user interacts
      }
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load villages from public/data/guam_villages.geojson
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/guam_villages.geojson`)
      .then((r) => r.json())
      .then((geo) => setVillages(geoJsonToVillages(geo)))
      .catch((e) => {
        console.error("Failed to load villages geojson:", e);
        setVillages([]);
      });
  }, []);

  useEffect(() => {
    const base = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
    if (!base) {
      setApiStatus("down");
      return;
    }
    fetch(`${base}/api/health`)
      .then((r) => (r.ok ? setApiStatus("up") : setApiStatus("down")))
      .catch(() => setApiStatus("down"));
  }, []);

  /* ===================== FIT BOUNDS ON VILLAGE SELECT ===================== */
  useEffect(() => {
    if (!selectedVillageId || !mapRef.current) return;
    const v = villages.find((x) => x.id === selectedVillageId);
    if (!v) return;
    const bb = ringBBox(v.polygon);
    mapRef.current.fitBounds(
      [
        [bb.minLng, bb.minLat],
        [bb.maxLng, bb.maxLat],
      ],
      { padding: 30, maxZoom: 13 },
    );
  }, [selectedVillageId, villages]);

  /* ===================== FLY TO ON SELECTED PLACE/EVENT ===================== */
  const focus = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = PLACES.find((x) => x.id === selected.id);
      return p ? { lat: p.lat, lng: p.lng } : null;
    }
    const e = EVENTS.find((x) => x.id === selected.id);
    return e ? { lat: e.lat, lng: e.lng } : null;
  }, [selected]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(mapRef.current.getZoom(), 13),
    });
  }, [focus]);

  const selectedVillageName = useMemo(() => {
    if (!selectedVillageId) return "All Guam";
    return villages.find((v) => v.id === selectedVillageId)?.name ?? "All Guam";
  }, [selectedVillageId, villages]);

  const villagePlaces = useMemo(() => {
    if (!selectedVillageId) return [];
    return PLACES.filter((p) => p.villageId === selectedVillageId);
  }, [selectedVillageId]);

  const restaurants = villagePlaces.filter((p) => p.type === "RESTAURANT");
  const attractions = villagePlaces.filter((p) => p.type === "ATTRACTION");
  const hotels = villagePlaces.filter((p) => p.type === "HOTEL");

  const searchLower = search.trim().toLowerCase();

  const filteredPlaces = useMemo(() => {
    return PLACES.filter((p) => {
      if (selectedVillageId && p.villageId !== selectedVillageId) return false;
      if (category !== "ALL" && p.type !== category) return false;
      if (searchLower && !JSON.stringify(p).toLowerCase().includes(searchLower)) return false;
      if (openNow && !mockOpenNow(p)) return false;
      if (nearMe) {
        if (!userLoc) return false;
        if (haversineKm(userLoc.lat, userLoc.lng, p.lat, p.lng) > 5) return false;
      }
      return true;
    });
  }, [selectedVillageId, category, searchLower, openNow, nearMe, userLoc]);

  const filteredEvents = useMemo(() => {
    return EVENTS.filter((e) => {
      if (selectedVillageId && e.villageId !== selectedVillageId) return false;
      if (category !== "ALL") return false;
      if (searchLower && !JSON.stringify(e).toLowerCase().includes(searchLower)) return false;
      if (nearMe) {
        if (!userLoc) return false;
        if (haversineKm(userLoc.lat, userLoc.lng, e.lat, e.lng) > 5) return false;
      }
      return true;
    });
  }, [selectedVillageId, category, searchLower, nearMe, userLoc]);

  const results = useMemo(() => {
    const combined: Array<{ kind: "PLACE"; data: Place } | { kind: "EVENT"; data: EventItem }> = [
      ...filteredPlaces.map((p) => ({ kind: "PLACE" as const, data: p })),
      ...filteredEvents.map((e) => ({ kind: "EVENT" as const, data: e })),
    ];

    combined.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "PLACE" ? -1 : 1;
      if (userLoc) {
        const da = haversineKm(userLoc.lat, userLoc.lng, a.data.lat, a.data.lng);
        const db = haversineKm(userLoc.lat, userLoc.lng, b.data.lat, b.data.lng);
        return da - db;
      }
      const an = a.kind === "PLACE" ? a.data.name : a.data.title;
      const bn = b.kind === "PLACE" ? b.data.name : b.data.title;
      return an.localeCompare(bn);
    });

    return combined;
  }, [filteredPlaces, filteredEvents, userLoc]);

  function reset() {
    setSelectedVillageId(null);
    setCategory("ALL");
    setSearch("");
    setOpenNow(false);
    setNearMe(false);
    setSelected(null);
    setPopupInfo(null);
  }

  function locateMe() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    const onPos = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null;

      setUserLoc({ lat, lng });
      setUserAcc(acc);

      if (villages.length) {
        if (acc === null || acc <= 1500) {
          const v = findVillageForPoint(villages, lat, lng);
          if (v) {
            setSelectedVillageId(v.id);
            setSelected(null);
          }
        }
      }
    };

    navigator.geolocation.getCurrentPosition(onPos, () => alert("Could not access location."), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  }

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = PLACES.find((x) => x.id === selected.id);
      return p ? { kind: "PLACE" as const, p } : null;
    }
    const e = EVENTS.find((x) => x.id === selected.id);
    return e ? { kind: "EVENT" as const, e } : null;
  }, [selected]);

  /* ===================== VILLAGE GEOJSON FOR MAPBOX ===================== */

  const villageGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: villages.map((v) => ({
        type: "Feature",
        properties: {
          id: v.id,
          name: v.name,
          selected: v.id === selectedVillageId ? 1 : 0,
        },
        geometry: {
          type: "Polygon",
          coordinates: [v.polygon],
        },
      })),
    };
  }, [villages, selectedVillageId]);

  /** Point centroids for village name labels */
  const villageLabelGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: villages.map((v) => {
        // Compute centroid of polygon ring
        let sumLng = 0, sumLat = 0;
        const n = v.polygon.length;
        for (const [lng, lat] of v.polygon) {
          sumLng += lng;
          sumLat += lat;
        }
        return {
          type: "Feature" as const,
          properties: {
            id: v.id,
            name: v.name,
            selected: v.id === selectedVillageId ? 1 : 0,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [sumLng / n, sumLat / n],
          },
        };
      }),
    };
  }, [villages, selectedVillageId]);

  /* ===================== USER LOCATION GEOJSON ===================== */

  const userLocGeoJson = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!userLoc) return null;
    const radius = userAcc ? Math.max(80, Math.min(userAcc, 600)) : 80;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [circlePolygon(userLoc.lng, userLoc.lat, radius)],
          },
        },
      ],
    };
  }, [userLoc, userAcc]);

  /* ===================== LIVE HOTSPOTS GEOJSON ===================== */

  const liveGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: LIVE.map((x) => ({
        type: "Feature",
        properties: { id: x.id, label: x.label, count: x.count },
        geometry: {
          type: "Polygon",
          coordinates: [
            circlePolygon(x.lng, x.lat, Math.max(300, Math.min(2000, x.count * 35))),
          ],
        },
      })),
    };
  }, []);

  /* ===================== IMPERATIVE VILLAGE LAYERS ===================== */

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady) return;

    const SRC = "villages";
    const SRC_LABELS = "village-labels";

    // Add or update village polygon source + layers
    const existingSrc = map.getSource(SRC) as any;
    if (existingSrc) {
      existingSrc.setData(villageGeoJson);
    } else {
      map.addSource(SRC, { type: "geojson", data: villageGeoJson });
      map.addLayer({
        id: "village-fill",
        type: "fill",
        source: SRC,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "rgba(69,217,168,0.25)",
            "rgba(69,217,168,0.10)",
          ],
          "fill-opacity": 1,
          "fill-emissive-strength": 1,
        },
      } as any);
      map.addLayer({
        id: "village-outline",
        type: "line",
        source: SRC,
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "rgba(69,217,168,0.9)",
            "rgba(69,217,168,0.55)",
          ],
          "line-width": [
            "case",
            ["==", ["get", "selected"], 1],
            3,
            1.5,
          ],
          "line-emissive-strength": 1,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      } as any);
    }

    // Add or update village label source + layer
    const existingLabelSrc = map.getSource(SRC_LABELS) as any;
    if (existingLabelSrc) {
      existingLabelSrc.setData(villageLabelGeoJson);
    } else {
      map.addSource(SRC_LABELS, { type: "geojson", data: villageLabelGeoJson });
      map.addLayer({
        id: "village-label",
        type: "symbol",
        source: SRC_LABELS,
        layout: {
          "text-field": ["get", "name"],
          "text-size": [
            "case",
            ["==", ["get", "selected"], 1],
            14,
            11,
          ],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-padding": 6,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
        },
        paint: {
          "text-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "rgba(69,217,168,1)",
            "rgba(69,217,168,0.65)",
          ],
          "text-halo-color": "rgba(0,0,0,0.85)",
          "text-halo-width": 2,
          "text-emissive-strength": 1,
        },
      } as any);
    }

    // Toggle visibility
    const vis = showVillages ? "visible" : "none";
    if (map.getLayer("village-fill")) map.setLayoutProperty("village-fill", "visibility", vis);
    if (map.getLayer("village-outline")) map.setLayoutProperty("village-outline", "visibility", vis);
    if (map.getLayer("village-label")) map.setLayoutProperty("village-label", "visibility", vis);

    // Hide/show Standard style labels based on village overlay
    try {
      const showLabels = !showVillages;
      (map as any).setConfigProperty("basemap", "showPlaceLabels", showLabels);
      (map as any).setConfigProperty("basemap", "showPointOfInterestLabels", showLabels);
      (map as any).setConfigProperty("basemap", "showRoadLabels", showLabels);
      (map as any).setConfigProperty("basemap", "showTransitLabels", showLabels);
    } catch {
      // Standard style config not available
    }
  }, [mapReady, villageGeoJson, villageLabelGeoJson, showVillages]);

  /* ===================== MAP EVENT HANDLERS ===================== */

  const onVillageClick = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const villageId = feature.properties?.id as string;
      setSelectedVillageId(villageId);
      setSelected(null);
      setPopupInfo({
        kind: "VILLAGE",
        village: villages.find((v) => v.id === villageId)!,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    },
    [villages],
  );

  const onMouseEnter = useCallback(() => setCursor("pointer"), []);
  const onMouseLeave = useCallback(() => setCursor(""), []);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          <div>
            GuamRadar <span className={styles.muted}>WIP</span>
          </div>
        </div>

        <div className={styles.topRight}>
          <button
            className={`${styles.pill} ${musicOn ? styles.pillActive : ""}`}
            onClick={toggleMusic}
            title="Toggle background music"
          >
            {musicOn ? "🔊 Music: ON" : "🔇 Music: OFF"}
          </button>

          <span className={styles.pill}>Map-first ➜ click pins ➜ see details</span>
          <span className={styles.pill}>
            API:{" "}
            <b>{apiStatus === "checking" ? "checking" : apiStatus === "up" ? "up" : "not set/down"}</b>
          </span>
        </div>
      </div>

      <div className={styles.main}>
        {/* MAP */}
        <div className={styles.mapWrap}>
          <div className={styles.mapHud}>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showPOI ? styles.pillActive : ""}`}
              onClick={() => setShowPOI((s) => !s)}
            >
              POIs
            </button>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showEvents ? styles.pillActive : ""}`}
              onClick={() => setShowEvents((s) => !s)}
            >
              Events
            </button>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showLive ? styles.pillActive : ""}`}
              onClick={() => setShowLive((s) => !s)}
            >
              Live
            </button>
            <button className={`${styles.pill} ${styles.hudPill}`} onClick={locateMe}>
              Use my location
            </button>
          </div>

          <div className={styles.mapCard}>
          <div className={styles.map} style={{ width: "100%", height: "100%" }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: DEFAULT_CENTER.lng,
              latitude: DEFAULT_CENTER.lat,
              zoom: DEFAULT_ZOOM,
            }}
            mapStyle="mapbox://styles/mapbox/standard"
            style={{
              width: "100%",
              height: "100%",
              background: "#0b0b19",
              opacity: mapReady ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
            interactiveLayerIds={showVillages ? ["village-fill"] : []}
            onClick={onVillageClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            cursor={cursor}
            onLoad={(e) => {
              const map = e.target;
              try {
                (map as any).setConfigProperty("basemap", "lightPreset", "night");
                map.setProjection("globe");
              } catch (err) {
                console.warn("Map config error:", err);
              }
              // Wait until map has fully repainted with night mode before showing
              map.once("idle", () => setMapReady(true));
            }}
          >
            <NavigationControl position="top-left" showCompass />

            {/* Center on Guam button — styled like zoom controls */}
            <div className={styles.centerBtn} title="Center on Guam" onClick={() => {
              mapRef.current?.flyTo({
                center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
                zoom: DEFAULT_ZOOM,
                duration: 1000,
              });
            }}>
              <img src="/guam.png" alt="Guam" width="20" height="20" style={{ objectFit: "contain" }} />
            </div>

            {/* Toggle village highlights */}
            <div
              className={`${styles.centerBtn} ${styles.villageToggle}`}
              title={showVillages ? "Hide village borders" : "Show village borders"}
              onClick={() => setShowVillages((v) => !v)}
              style={{ opacity: showVillages ? 1 : 0.5 }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(69,217,168,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </div>

            {/* Village polygons + labels managed imperatively via useEffect above */}

            {/* User location circle */}
            {mapReady && userLocGeoJson && (
              <Source id="user-loc" type="geojson" data={userLocGeoJson}>
                <Layer
                  id="user-loc-fill"
                  type="fill"
                  paint={{
                    "fill-color": "rgba(69,217,168,0.25)",
                    "fill-opacity": 1,
                    "fill-emissive-strength": 1,
                  } as any}
                />
                <Layer
                  id="user-loc-outline"
                  type="line"
                  paint={{
                    "line-color": "rgba(69,217,168,0.9)",
                    "line-width": 2,
                    "line-emissive-strength": 1,
                  } as any}
                />
              </Source>
            )}

            {/* User location marker */}
            {userLoc && (
              <Marker
                longitude={userLoc.lng}
                latitude={userLoc.lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setPopupInfo({
                    kind: "USER",
                    lng: userLoc.lng,
                    lat: userLoc.lat,
                    acc: userAcc,
                  });
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#45d9a8",
                    border: "2px solid white",
                    boxShadow: "0 0 6px rgba(69,217,168,0.6)",
                  }}
                />
              </Marker>
            )}

            {/* POI markers */}
            {showPOI &&
              filteredPlaces.map((p) => (
                <Marker
                  key={p.id}
                  longitude={p.lng}
                  latitude={p.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelected({ kind: "PLACE", id: p.id });
                    setPopupInfo({ kind: "PLACE", place: p });
                  }}
                >
                  <EmojiPin
                    emoji={placeEmoji(p.type)}
                    border="rgba(255,255,255,0.18)"
                    bg="rgba(20,20,20,0.85)"
                  />
                </Marker>
              ))}

            {/* Event markers */}
            {showEvents &&
              filteredEvents.map((ev) => (
                <Marker
                  key={ev.id}
                  longitude={ev.lng}
                  latitude={ev.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelected({ kind: "EVENT", id: ev.id });
                    setPopupInfo({ kind: "EVENT", event: ev });
                  }}
                >
                  <EmojiPin
                    emoji={eventEmoji(ev.status)}
                    border={
                      ev.status === "VERIFIED"
                        ? "rgba(69,217,168,0.45)"
                        : "rgba(245,158,11,0.45)"
                    }
                    bg={
                      ev.status === "VERIFIED"
                        ? "rgba(69,217,168,0.12)"
                        : "rgba(245,158,11,0.12)"
                    }
                  />
                </Marker>
              ))}

            {/* Live hotspot zones */}
            {mapReady && showLive && (
              <Source id="live-zones" type="geojson" data={liveGeoJson}>
                <Layer
                  id="live-fill"
                  type="fill"
                  paint={{
                    "fill-color": "rgba(245,158,11,0.18)",
                    "fill-opacity": 0.9,
                    "fill-emissive-strength": 1,
                  } as any}
                />
                <Layer
                  id="live-outline"
                  type="line"
                  paint={{
                    "line-color": "rgba(245,158,11,0.55)",
                    "line-width": 2,
                    "line-emissive-strength": 1,
                  } as any}
                />
              </Source>
            )}

            {/* Live hotspot markers (clickable centers) */}
            {showLive &&
              LIVE.map((x) => (
                <Marker
                  key={x.id}
                  longitude={x.lng}
                  latitude={x.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPopupInfo({ kind: "LIVE", hotspot: x });
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "rgba(245,158,11,0.8)",
                      border: "1px solid rgba(245,158,11,1)",
                    }}
                  />
                </Marker>
              ))}

            {/* Popup */}
            {popupInfo && popupInfo.kind === "VILLAGE" && (
              <Popup
                longitude={popupInfo.lng}
                latitude={popupInfo.lat}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
              >
                <b>{popupInfo.village.name}</b>
                <div className={styles.muted}>Tap to explore</div>
              </Popup>
            )}

            {popupInfo && popupInfo.kind === "PLACE" && (
              <Popup
                longitude={popupInfo.place.lng}
                latitude={popupInfo.place.lat}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
              >
                <b>{popupInfo.place.name}</b>
                <div className={styles.muted}>
                  {popupInfo.place.type} • {popupInfo.place.source}
                </div>
              </Popup>
            )}

            {popupInfo && popupInfo.kind === "EVENT" && (
              <Popup
                longitude={popupInfo.event.lng}
                latitude={popupInfo.event.lat}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
              >
                <b>{popupInfo.event.title}</b>
                <div className={styles.muted}>
                  {popupInfo.event.when ?? ""} • {popupInfo.event.source}
                </div>
              </Popup>
            )}

            {popupInfo && popupInfo.kind === "USER" && (
              <Popup
                longitude={popupInfo.lng}
                latitude={popupInfo.lat}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
              >
                <b>You are here</b>
                <div className={styles.muted}>
                  {popupInfo.lat.toFixed(5)}, {popupInfo.lng.toFixed(5)}
                  {typeof popupInfo.acc === "number" ? ` • ±${Math.round(popupInfo.acc)}m` : ""}
                </div>
              </Popup>
            )}

            {popupInfo && popupInfo.kind === "LIVE" && (
              <Popup
                longitude={popupInfo.hotspot.lng}
                latitude={popupInfo.hotspot.lat}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
              >
                <b>Live activity</b>
                <div>{popupInfo.hotspot.label}</div>
                <div className={styles.muted}>{popupInfo.hotspot.count} recent check-ins (demo)</div>
              </Popup>
            )}
          </Map>
          </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.tinyMuted}>Selected Village</div>
                <div className={styles.bigText}>{selectedVillageName}</div>
              </div>
              <div className={styles.badgeGood}>WIP demo data</div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.section}>
                <div className={styles.tinyMuted}>Category</div>
                <div className={styles.chipRow}>
                  {(["ALL", "ATTRACTION", "RESTAURANT", "HOTEL"] as Category[]).map((c) => (
                    <button
                      key={c}
                      className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
                      onClick={() => setCategory(c)}
                    >
                      {c === "ALL"
                        ? "All"
                        : c === "ATTRACTION"
                        ? "Attractions"
                        : c === "RESTAURANT"
                        ? "Restaurants"
                        : "Hotels"}
                    </button>
                  ))}
                </div>

                <input
                  className={styles.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search places/events (e.g., beach, market)"
                />

                <div className={styles.rowBetween}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={openNow}
                      onChange={(e) => setOpenNow(e.target.checked)}
                    />{" "}
                    Open now
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={nearMe}
                      onChange={(e) => setNearMe(e.target.checked)}
                    />{" "}
                    Near me
                  </label>
                  <button className={styles.btn} onClick={reset}>
                    Reset
                  </button>
                </div>

                {nearMe && !userLoc && (
                  <div className={styles.notice}>
                    Turned on "Near me" — tap <b>Use my location</b> on the map.
                  </div>
                )}
              </div>

              <div className={styles.sectionHeader}>
                <span className={styles.tinyMuted}>Results</span>
                <span className={styles.tinyMuted}>{results.length} items</span>
              </div>

              <div className={styles.list}>
                {results.length === 0 ? (
                  <div className={styles.empty}>No results. Try resetting filters.</div>
                ) : (
                  results.map((r) => {
                    const title = r.kind === "PLACE" ? r.data.name : r.data.title;
                    const meta =
                      r.kind === "PLACE"
                        ? `${r.data.type} • ${r.data.source}`
                        : `${
                            r.data.status === "VERIFIED" ? "Event (Verified)" : "Event (Pending)"
                          } • ${r.data.source}`;

                    const dist = userLoc
                      ? haversineKm(userLoc.lat, userLoc.lng, r.data.lat, r.data.lng)
                      : null;

                    return (
                      <button
                        key={`${r.kind}:${r.data.id}`}
                        className={styles.item}
                        onClick={() => setSelected({ kind: r.kind, id: r.data.id } as any)}
                      >
                        <div className={styles.itemTop}>
                          <div className={styles.itemTitle}>{title}</div>
                          <div
                            className={
                              r.kind === "EVENT"
                                ? r.data.status === "VERIFIED"
                                  ? styles.badgeGood
                                  : styles.badgeWarn
                                : styles.badge
                            }
                          >
                            {r.kind === "PLACE" ? r.data.type : r.data.status}
                          </div>
                        </div>
                        <div className={styles.itemDesc}>{meta}</div>
                        <div className={styles.itemMeta}>
                          {dist != null && <span>📍 {dist.toFixed(1)} km</span>}
                          {r.kind === "PLACE" ? <span>⏰ {r.data.hours}</span> : <span>🗓️ {r.data.when ?? ""}</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* DETAILS */}
          <div className={styles.card}>
            <div className={styles.cardHeader} onClick={() => setDetailsOpen((o) => !o)}>
              <div className={styles.bigTextSmall}>Details</div>
              <div className={styles.row}>
                {selectedDetail && (
                  <div className={styles.badge}>
                    {selectedDetail.kind === "PLACE"
                      ? selectedDetail.p.type
                      : selectedDetail.e.status}
                  </div>
                )}
                <span className={`${styles.chevron} ${detailsOpen ? styles.chevronOpen : ""}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </span>
              </div>
            </div>

            {detailsOpen && (
              <div className={styles.cardBody}>
                {!selectedDetail ? (
                  <div className={styles.muted}>Click a marker or result to see details.</div>
                ) : selectedDetail.kind === "PLACE" ? (
                  <>
                    <div className={styles.detailTitle}>{selectedDetail.p.name}</div>
                    <div className={styles.muted}>
                      {selectedDetail.p.source} • {selectedDetail.p.price}
                    </div>
                    <div className={styles.detailText}>{selectedDetail.p.description ?? ""}</div>
                    <div className={styles.row}>
                      <a
                        className={styles.btnPrimary}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps?q=${selectedDetail.p.lat},${selectedDetail.p.lng}`}
                      >
                        Directions
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.detailTitle}>{selectedDetail.e.title}</div>
                    <div className={styles.muted}>{selectedDetail.e.when ?? ""}</div>
                    <div className={styles.detailText}>{selectedDetail.e.description ?? ""}</div>
                    <div className={styles.row}>
                      <a
                        className={styles.btnPrimary}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps?q=${selectedDetail.e.lat},${selectedDetail.e.lng}`}
                      >
                        Directions
                      </a>
                    </div>
                  </>
                )}

                <div className={styles.footerNote}>
                  AI Planner + Admin tools: <b>coming soon</b> (keep front page clean for now).
                </div>
              </div>
            )}
          </div>

          {/* VILLAGE BROWSE */}
          <div className={styles.card}>
            <div className={styles.cardHeader} onClick={() => setVillageOpen((o) => !o)}>
              <div className={styles.bigTextSmall}>Browse by Village</div>
              <span className={`${styles.chevron} ${villageOpen ? styles.chevronOpen : ""}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </div>
            {villageOpen && (
              <div className={styles.cardBody}>
                <div className={styles.dropdown} ref={dropdownRef}>
                  <button
                    className={styles.dropdownTrigger}
                    onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }}
                  >
                    <span className={selectedVillageId ? undefined : styles.dropdownPlaceholder}>
                      {selectedVillageId
                        ? villages.find((v) => v.id === selectedVillageId)?.name ?? "Select village"
                        : "Select village"}
                    </span>
                    <span className={`${styles.dropdownArrow} ${dropdownOpen ? styles.dropdownArrowOpen : ""}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </span>
                  </button>
                  {dropdownOpen && (
                    <div className={styles.dropdownMenu}>
                      <button
                        className={`${styles.dropdownItem} ${!selectedVillageId ? styles.dropdownItemActive : ""}`}
                        onClick={() => {
                          setSelectedVillageId(null);
                          setDropdownOpen(false);
                          mapRef.current?.flyTo({
                            center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
                            zoom: DEFAULT_ZOOM,
                            duration: 1000,
                          });
                        }}
                      >
                        All villages
                      </button>
                      {villages.map((v) => (
                        <button
                          key={v.id}
                          className={`${styles.dropdownItem} ${selectedVillageId === v.id ? styles.dropdownItemActive : ""}`}
                          onClick={() => { setSelectedVillageId(v.id); setDropdownOpen(false); }}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedVillageId && (
                  <>
                    <h4>Restaurants</h4>
                    {restaurants.length === 0 ? (
                      <div className={styles.muted}>None in this village.</div>
                    ) : (
                      restaurants.map((p) => (
                        <button
                          key={p.id}
                          className={styles.item}
                          onClick={() => setSelected({ kind: "PLACE", id: p.id })}
                        >
                          {p.name}
                        </button>
                      ))
                    )}

                    <h4>Attractions</h4>
                    {attractions.length === 0 ? (
                      <div className={styles.muted}>None in this village.</div>
                    ) : (
                      attractions.map((p) => (
                        <button
                          key={p.id}
                          className={styles.item}
                          onClick={() => setSelected({ kind: "PLACE", id: p.id })}
                        >
                          {p.name}
                        </button>
                      ))
                    )}

                    <h4>Hotels</h4>
                    {hotels.length === 0 ? (
                      <div className={styles.muted}>None in this village.</div>
                    ) : (
                      hotels.map((p) => (
                        <button
                          key={p.id}
                          className={styles.item}
                          onClick={() => setSelected({ kind: "PLACE", id: p.id })}
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
