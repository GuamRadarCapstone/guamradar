import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import styles from "./HomePage.module.css";
import { EVENTS, LIVE, PLACES, type EventItem, type Place } from "./demoData";

/* ===================== VILLAGES (GeoJSON -> Leaflet) ===================== */
type Village = { id: string; name: string; polygon: [number, number][] };

function normalizeVillageId(name: string) {
  return name
    .replace(/\bMunicipality\b/gi, "")
    .replace(/[’']/g, "")
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

function toRingLatLng(coords: any[]): [number, number][] {
  // coords are [lng,lat] -> [lat,lng]
  return coords.map(([lng, lat]: [number, number]) => [lat, lng]);
}

// --- NEW: bbox helpers to avoid off-island fragments hijacking village polygons ---
function ringBBox(ring: [number, number][]) {
  let minLat = Infinity,
    minLng = Infinity,
    maxLat = -Infinity,
    maxLng = -Infinity;
  for (const [lat, lng] of ring) {
    if (lat < minLat) minLat = lat;
    if (lng < minLng) minLng = lng;
    if (lat > maxLat) maxLat = lat;
    if (lng > maxLng) maxLng = lng;
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

function geoJsonToVillages(geo: any): Village[] {
  const features = geo?.features ?? [];

  // Main island “window” for Guam to avoid selecting far-off fragments/islets
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

      // Remove non-village polygons
      if (rawName === "Guam" || rawName === "United States") return null;

      const id = normalizeVillageId(rawName);
      const cleanName = rawName.replace(/\bMunicipality\b/gi, "").trim();

      const candidateRings: [number, number][][] = [];

      if (geom.type === "Polygon") {
        const outer = geom.coordinates?.[0];
        if (outer?.length) candidateRings.push(toRingLatLng(outer));
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates ?? []) {
          const outer = poly?.[0];
          if (outer?.length) candidateRings.push(toRingLatLng(outer));
        }
      } else {
        return null;
      }

      if (!candidateRings.length) return null;

      // Pick the ring that overlaps Guam main bbox the most.
      // IMPORTANT: use absolute overlap area (not overlap/area) so tiny fragments/islets
      // don't win just because they're fully inside the bounding box.
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

// Ray-casting point-in-polygon for a single outer ring.
// ring is [[lat,lng], ...]
function pointInRing(lat: number, lng: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findVillageForPoint(villages: Village[], lat: number, lng: number): Village | null {
  // First pass: strict contains
  for (const v of villages) {
    if (pointInRing(lat, lng, v.polygon)) return v;
  }
  return null;
}

/* ===================== TYPES ===================== */

type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type Selected = { kind: "PLACE"; id: string } | { kind: "EVENT"; id: string } | null;

/* ===================== CONSTANTS ===================== */

const DEFAULT_CENTER: [number, number] = [13.45, 144.78];
const DEFAULT_ZOOM = 11;

/* ===================== MUSIC (background) ===================== */
// Put your file here: frontend/public/bgm.mp3
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

function emojiIcon(emoji: string, border: string, bg: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    html: `<div style="
      width:30px;height:30px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      border:1px solid ${border};
      background:${bg};
      box-shadow: 0 10px 18px rgba(0,0,0,0.25);
      font-size:16px;
    ">${emoji}</div>`,
  });
}

function placeIcon(type: Place["type"]) {
  if (type === "RESTAURANT")
    return emojiIcon("🍴", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
  if (type === "HOTEL")
    return emojiIcon("🏨", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
  return emojiIcon("📍", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
}

function eventIcon(status: EventItem["status"]) {
  return status === "VERIFIED"
    ? emojiIcon("📅", "rgba(34,197,94,0.45)", "rgba(34,197,94,0.12)")
    : emojiIcon("🕓", "rgba(245,158,11,0.45)", "rgba(245,158,11,0.12)");
}

/* ===================== MAP CONTROLLER ===================== */

function MapController({
  villages,
  selectedVillageId,
  focus,
}: {
  villages: Village[];
  selectedVillageId: string | null;
  focus: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedVillageId) return;
    const v = villages.find((x) => x.id === selectedVillageId);
    if (!v) return;
    const bounds = L.latLngBounds(v.polygon as any);
    // NEW: maxZoom prevents weird “zoom into tiny fragment”
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  }, [map, selectedVillageId, villages]);

  useEffect(() => {
    if (!focus) return;
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 13));
  }, [map, focus]);

  return null;
}

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
  const [userAcc, setUserAcc] = useState<number | null>(null); // meters
  const [selected, setSelected] = useState<Selected>(null);

  // Optional: show API health on the top bar (works once you set VITE_API_BASE_URL)
  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");

  /* ===================== MUSIC STATE ===================== */
  const [musicOn, setMusicOn] = useState(false);
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
        await a.play(); // requires a user click
        setMusicOn(true);
      } catch {
        // autoplay blocked until user interacts
      }
    }
  };

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

  // Debug: shows what loaded
  useEffect(() => {
    console.log(
      "Loaded villages:",
      villages.map((v) => v.name).sort()
    );
  }, [villages]);

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

  const focus = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = PLACES.find((x) => x.id === selected.id);
      return p ? { lat: p.lat, lng: p.lng } : null;
    }
    const e = EVENTS.find((x) => x.id === selected.id);
    return e ? { lat: e.lat, lng: e.lng } : null;
  }, [selected]);

  function reset() {
    setSelectedVillageId(null);
    setCategory("ALL");
    setSearch("");
    setOpenNow(false);
    setNearMe(false);
    setSelected(null);
  }

  function locateMe() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    const onPos = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null;

      setUserLoc({ lat, lng });
      setUserAcc(acc);

      // Auto-detect your village from the polygon the point falls in.
      // If the browser's location is very imprecise (desktop/IP-based), don't force a village.
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
          {/* NEW: MUSIC TOGGLE */}
          <button
            className={styles.pill}
            onClick={toggleMusic}
            style={{ cursor: "pointer" }}
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
        <div className={styles.mapCard}>
          <div className={styles.mapHud}>
            <button
              className={`${styles.hudBtn} ${showPOI ? styles.active : ""}`}
              onClick={() => setShowPOI((s) => !s)}
            >
              POIs
            </button>
            <button
              className={`${styles.hudBtn} ${showEvents ? styles.active : ""}`}
              onClick={() => setShowEvents((s) => !s)}
            >
              Events
            </button>
            <button
              className={`${styles.hudBtn} ${showLive ? styles.active : ""}`}
              onClick={() => setShowLive((s) => !s)}
            >
              Live
            </button>
            <button className={styles.hudBtn} onClick={locateMe}>
              Use my location
            </button>
          </div>

          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className={styles.map}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController villages={villages} selectedVillageId={selectedVillageId} focus={focus} />

            {villages.map((v) => (
              <Polygon
                key={v.id}
                positions={v.polygon}
                pathOptions={{
                  color:
                    selectedVillageId === v.id
                      ? "rgba(167,139,250,0.85)"
                      : "rgba(76,201,240,0.55)",
                  weight: selectedVillageId === v.id ? 3 : 2,
                  fillColor:
                    selectedVillageId === v.id
                      ? "rgba(167,139,250,0.20)"
                      : "rgba(76,201,240,0.10)",
                  fillOpacity: 0.8,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedVillageId(v.id);
                    setSelected(null);
                  },
                }}
              >
                <Popup>
                  <b>{v.name}</b>
                  <div className={styles.muted}>Tap to explore</div>
                </Popup>
              </Polygon>
            ))}

            {userLoc && (
              <Circle
                center={[userLoc.lat, userLoc.lng]}
                // Show GPS accuracy if available (clamped so it doesn't take over the map)
                radius={userAcc ? Math.max(80, Math.min(userAcc, 600)) : 80}
                pathOptions={{
                  color: "rgba(34,197,94,0.9)",
                  fillColor: "rgba(34,197,94,0.25)",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  <b>You are here</b>
                  <div className={styles.muted}>
                    {userLoc.lat.toFixed(5)}, {userLoc.lng.toFixed(5)}
                    {typeof userAcc === "number" ? ` • ±${Math.round(userAcc)}m` : ""}
                  </div>
                </Popup>
              </Circle>
            )}

            {showPOI &&
              filteredPlaces.map((p) => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={placeIcon(p.type)}
                  eventHandlers={{
                    click: () => setSelected({ kind: "PLACE", id: p.id }),
                  }}
                >
                  <Popup>
                    <b>{p.name}</b>
                    <div className={styles.muted}>
                      {p.type} • {p.source}
                    </div>
                  </Popup>
                </Marker>
              ))}

            {showEvents &&
              filteredEvents.map((e) => (
                <Marker
                  key={e.id}
                  position={[e.lat, e.lng]}
                  icon={eventIcon(e.status)}
                  eventHandlers={{
                    click: () => setSelected({ kind: "EVENT", id: e.id }),
                  }}
                >
                  <Popup>
                    <b>{e.title}</b>
                    <div className={styles.muted}>
                      {e.when ?? ""} • {e.source}
                    </div>
                  </Popup>
                </Marker>
              ))}

            {showLive &&
              LIVE.map((x) => (
                <Circle
                  key={x.id}
                  center={[x.lat, x.lng]}
                  radius={Math.max(300, Math.min(2000, x.count * 35))}
                  pathOptions={{
                    color: "rgba(245,158,11,0.55)",
                    fillColor: "rgba(245,158,11,0.18)",
                    fillOpacity: 0.9,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <b>Live activity</b>
                    <div>{x.label}</div>
                    <div className={styles.muted}>{x.count} recent check-ins (demo)</div>
                  </Popup>
                </Circle>
              ))}
          </MapContainer>
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
            <div className={styles.cardHeader}>
              <div className={styles.bigTextSmall}>Details</div>
              <div className={styles.badge}>
                {selectedDetail?.kind === "PLACE"
                  ? selectedDetail.p.type
                  : selectedDetail?.kind === "EVENT"
                  ? selectedDetail.e.status
                  : "—"}
              </div>
            </div>

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
          </div>

          {/* VILLAGE BROWSE */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.bigTextSmall}>Browse by Village</div>
            </div>
            <div className={styles.cardBody}>
              <select
                className={styles.input}
                value={selectedVillageId ?? ""}
                onChange={(e) => setSelectedVillageId(e.target.value || null)}
              >
                <option value="">Select village</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>

              {!selectedVillageId ? (
                <div className={styles.muted}>Select a village to explore.</div>
              ) : (
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
          </div>
        </div>
      </div>
    </div>
  );
} //Yes sir  this is my homepage.tsx. Just replace or update anything that needs to be changed but keep everythign else
