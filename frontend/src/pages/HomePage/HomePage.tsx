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
import {
  EVENTS,
  LIVE,
  PLACES,
  VILLAGES,
  type EventItem,
  type Place,
} from "./demoData";

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

function emojiIcon(emoji: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    html: `<div style="
      width:30px;height:30px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      background:#0f172a;
      box-shadow:0 10px 18px rgba(0,0,0,0.25);
      font-size:16px;
    ">${emoji}</div>`,
  });
}
// Test
function placeIcon(type: Place["type"]) {
  if (type === "RESTAURANT") return emojiIcon("🍴");
  if (type === "HOTEL") return emojiIcon("🏨");
  return emojiIcon("📍");
}

function MapController({
  selectedVillageId,
}: {
  selectedVillageId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedVillageId) return;
    const v = VILLAGES.find((x) => x.id === selectedVillageId);
    if (!v) return;
    map.fitBounds(L.latLngBounds(v.polygon as any), {
      padding: [30, 30],
    });
  }, [map, selectedVillageId]);

  return null;
}

export function HomePage() {
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [selected, setSelected] = useState<Selected>(null);

  const selectedVillageName = useMemo(() => {
    if (!selectedVillageId) return "All Guam";
    return (
      VILLAGES.find((v) => v.id === selectedVillageId)?.name ?? "All Guam"
    );
  }, [selectedVillageId]);

  const villagePlaces = useMemo(() => {
    if (!selectedVillageId) return [];
    return PLACES.filter((p) => p.villageId === selectedVillageId);
  }, [selectedVillageId]);

  const restaurants = villagePlaces.filter((p) => p.type === "RESTAURANT");
  const attractions = villagePlaces.filter((p) => p.type === "ATTRACTION");
  const hotels = villagePlaces.filter((p) => p.type === "HOTEL");

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      setUserLoc({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })
    );
  }

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      return PLACES.find((p) => p.id === selected.id) ?? null;
    }
    return EVENTS.find((e) => e.id === selected.id) ?? null;
  }, [selected]);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          GuamRadar <span className={styles.muted}>WIP</span>
        </div>
        <button className={styles.hudBtn} onClick={locateMe}>
          Use my location
        </button>
      </div>

      <div className={styles.main}>
        {/* MAP */}
        <div className={styles.mapCard}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className={styles.map}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController selectedVillageId={selectedVillageId} />

            {VILLAGES.map((v) => (
              <Polygon
                key={v.id}
                positions={v.polygon}
                pathOptions={{
                  color:
                    selectedVillageId === v.id
                      ? "rgba(167,139,250,1)"
                      : "rgba(59,130,246,0.9)",
                  fillColor:
                    selectedVillageId === v.id
                      ? "rgba(167,139,250,0.35)"
                      : "rgba(59,130,246,0.12)",
                  weight: selectedVillageId === v.id ? 4 : 2,
                  fillOpacity: 0.9,
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
                </Popup>
              </Polygon>
            ))}

            {userLoc && (
              <Circle
                center={[userLoc.lat, userLoc.lng]}
                radius={80}
                pathOptions={{
                  color: "rgba(34,197,94,0.9)",
                  fillColor: "rgba(34,197,94,0.3)",
                  fillOpacity: 1,
                }}
              />
            )}

            {(selectedVillageId ? villagePlaces : PLACES).map((p) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={placeIcon(p.type)}
                eventHandlers={{
                  click: () =>
                    setSelected({ kind: "PLACE", id: p.id }),
                }}
              >
                <Popup>
                  <b>{p.name}</b>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.bigText}>{selectedVillageName}</div>
            </div>

            <select
              className={styles.input}
              value={selectedVillageId ?? ""}
              onChange={(e) =>
                setSelectedVillageId(e.target.value || null)
              }
            > 
              <option value="">Select village</option>
              {VILLAGES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            {!selectedVillageId ? (
              <div className={styles.notice}>
                Select a village to explore.
              </div>
            ) : (
              <>
                <h4>Restaurants</h4>
                {restaurants.map((p) => (
                  <button
                    key={p.id}
                    className={styles.item}
                    onClick={() =>
                      setSelected({ kind: "PLACE", id: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}

                <h4>Attractions</h4>
                {attractions.map((p) => (
                  <button
                    key={p.id}
                    className={styles.item}
                    onClick={() =>
                      setSelected({ kind: "PLACE", id: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}

                <h4>Hotels</h4>
                {hotels.map((p) => (
                  <button
                    key={p.id}
                    className={styles.item}
                    onClick={() =>
                      setSelected({ kind: "PLACE", id: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className={styles.card}>
            <h4>Details</h4>
            {!selectedDetail ? (
              <div className={styles.muted}>
                Click a marker or item.
              </div>
            ) : (
              <>
                <div className={styles.detailTitle}>
                  {"name" in selectedDetail
                    ? selectedDetail.name
                    : selectedDetail.title}
                </div>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${selectedDetail.lat},${selectedDetail.lng}`}
                >
                  Directions
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
