import { useEffect, useMemo, useState } from "react";
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
import { EVENTS, LIVE, PLACES, VILLAGES, type EventItem, type Place } from "./demoData";

type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type Selected =
  | { kind: "PLACE"; id: string }
  | { kind: "EVENT"; id: string }
  | null;

const DEFAULT_CENTER: [number, number] = [13.45, 144.78];
const DEFAULT_ZOOM = 11;

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
  // simple stable mock
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
  if (type === "RESTAURANT") return emojiIcon("🍴", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
  if (type === "HOTEL") return emojiIcon("🏨", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
  return emojiIcon("📍", "rgba(255,255,255,0.18)", "rgba(17,26,42,0.85)");
}

function eventIcon(status: EventItem["status"]) {
  return status === "VERIFIED"
    ? emojiIcon("📅", "rgba(34,197,94,0.45)", "rgba(34,197,94,0.12)")
    : emojiIcon("🕓", "rgba(245,158,11,0.45)", "rgba(245,158,11,0.12)");
}

function MapController({
  selectedVillageId,
  focus,
}: {
  selectedVillageId: string | null;
  focus: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedVillageId) return;
    const v = VILLAGES.find((x) => x.id === selectedVillageId);
    if (!v) return;
    const bounds = L.latLngBounds(v.polygon as any);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, selectedVillageId]);

  useEffect(() => {
    if (!focus) return;
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 13));
  }, [map, focus]);

  return null;
}

export function HomePage() {
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("ALL");
  const [search, setSearch] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  const [showPOI, setShowPOI] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showLive, setShowLive] = useState(false);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Selected>(null);

  // Optional: show API health on the top bar (works once you set VITE_API_BASE_URL)
  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");
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
    return VILLAGES.find((v) => v.id === selectedVillageId)?.name ?? "All Guam";
  }, [selectedVillageId]);

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
      if (category !== "ALL") return false; // keep Explore clean for now (same as prototype)
      if (searchLower && !JSON.stringify(e).toLowerCase().includes(searchLower)) return false;
      if (nearMe) {
        if (!userLoc) return false;
        if (haversineKm(userLoc.lat, userLoc.lng, e.lat, e.lng) > 5) return false;
      }
      return true;
    });
  }, [selectedVillageId, category, searchLower, nearMe, userLoc]);

  const results = useMemo(() => {
    const combined: Array<
      | { kind: "PLACE"; data: Place }
      | { kind: "EVENT"; data: EventItem }
    > = [
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => alert("Could not access location."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
          <span className={styles.pill}>Map-first ➜ click pins ➜ see details</span>
          <span className={styles.pill}>
            API:{" "}
            <b>
              {apiStatus === "checking" ? "checking" : apiStatus === "up" ? "up" : "not set/down"}
            </b>
          </span>
        </div>
      </div>

      <div className={styles.main}>
        {/* MAP */}
        <div className={styles.mapCard}>
          <div className={styles.mapHud}>
            <button className={`${styles.hudBtn} ${showPOI ? styles.active : ""}`} onClick={() => setShowPOI((s) => !s)}>
              POIs
            </button>
            <button className={`${styles.hudBtn} ${showEvents ? styles.active : ""}`} onClick={() => setShowEvents((s) => !s)}>
              Events
            </button>
            <button className={`${styles.hudBtn} ${showLive ? styles.active : ""}`} onClick={() => setShowLive((s) => !s)}>
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

            <MapController selectedVillageId={selectedVillageId} focus={focus} />

            {VILLAGES.map((v) => (
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
                radius={80}
                pathOptions={{
                  color: "rgba(34,197,94,0.9)",
                  fillColor: "rgba(34,197,94,0.25)",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  <b>You are here</b>
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
                      {c === "ALL" ? "All" : c === "ATTRACTION" ? "Attractions" : c === "RESTAURANT" ? "Restaurants" : "Hotels"}
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
                    <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} /> Open now
                  </label>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={nearMe} onChange={(e) => setNearMe(e.target.checked)} /> Near me
                  </label>
                  <button className={styles.btn} onClick={reset}>
                    Reset
                  </button>
                </div>

                {nearMe && !userLoc && (
                  <div className={styles.notice}>
                    Turned on “Near me” — tap <b>Use my location</b> on the map.
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
                        : `${r.data.status === "VERIFIED" ? "Event (Verified)" : "Event (Pending)"} • ${r.data.source}`;

                    const dist =
                      userLoc ? haversineKm(userLoc.lat, userLoc.lng, r.data.lat, r.data.lng) : null;

                    return (
                      <button
                        key={`${r.kind}:${r.data.id}`}
                        className={styles.item}
                        onClick={() => setSelected({ kind: r.kind, id: r.data.id } as any)}
                      >
                        <div className={styles.itemTop}>
                          <div className={styles.itemTitle}>{title}</div>
                          <div className={r.kind === "EVENT" ? (r.data.status === "VERIFIED" ? styles.badgeGood : styles.badgeWarn) : styles.badge}>
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
        </div>
      </div>
    </div>
  );
}

