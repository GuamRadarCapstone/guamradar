import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
  Marker,
} from "@vis.gl/react-google-maps";

import styles from "./HomePage.module.css";
import { EVENTS, LIVE, PLACES } from "./demoData";

import { useVillages } from "../../hooks/useVillages";
import { useUserLocation } from "../../hooks/useUserLocation";
import { useFilteredResults } from "../../hooks/useFilteredResults";
import { useMusic } from "../../hooks/useMusic";

import { ResultsList } from "../../components/ResultsList";
import { DetailsPanel } from "../../components/DetailsPanel";
import { VillageBrowser } from "../../components/VillageBrowser";
import AuthCard from "../../components/AuthCard";
import { SavedPoisCard } from "../../components/SavedPoisCard";
import {
  ItineraryCard,
  type ItineraryRow,
  type ItineraryItemRow,
} from "../../components/ItineraryCard";

import { DEFAULT_CENTER, GUAM_BOUNDS, GUAM_BOUNDS_PADDING } from "../../lib/constants";
import { placeEmoji, eventEmoji } from "../../lib/ui";
import { supabase } from "../../lib/supabase";

import type { Village, Place, EventItem, LiveHotspot } from "../../types/data";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

type Category =
  | "ALL"
  | "ATTRACTION"
  | "RESTAURANT"
  | "HOTEL"
  | "SHOPPING"
  | "SERVICE"
  | "SCHOOL"
  | "TRANSPORT"
  | "BASE"
  | "HOSPITAL";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ATTRACTION", label: "Attractions" },
  { value: "RESTAURANT", label: "Restaurants" },
  { value: "HOTEL", label: "Hotels" },
  { value: "SHOPPING", label: "Shopping" },
  { value: "SERVICE", label: "Services" },
  { value: "SCHOOL", label: "Schools" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "BASE", label: "Bases" },
  { value: "HOSPITAL", label: "Hospitals" },
];

type Selected = { kind: "PLACE"; id: string } | { kind: "EVENT"; id: string } | null;

type PopupInfo =
  | { kind: "VILLAGE"; village: Village; lng: number; lat: number }
  | { kind: "PLACE"; place: Place }
  | { kind: "EVENT"; event: EventItem }
  | { kind: "USER"; lng: number; lat: number; acc: number | null }
  | { kind: "LIVE"; hotspot: LiveHotspot }
  | null;

const _iconCache = new Map<string, string>();

function dotIcon(color: string, size: number, borderColor = "white") {
  const key = `dot:${color}:${size}:${borderColor}`;
  let url = _iconCache.get(key);
  if (!url) {
    url =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
          `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}" stroke="${borderColor}" stroke-width="2"/>` +
          `</svg>`,
      );
    _iconCache.set(key, url);
  }
  return url;
}

function emojiIcon(emoji: string, border: string, bg: string) {
  const key = `emoji:${emoji}:${border}:${bg}`;
  let url = _iconCache.get(key);
  if (!url) {
    const s = 30;
    url =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
          `<rect x=".5" y=".5" width="${s - 1}" height="${s - 1}" rx="6" ry="6" fill="${bg}" stroke="${border}" stroke-width="1"/>` +
          `<text x="${s / 2}" y="${s / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-size="16">${emoji}</text>` +
          `</svg>`,
      );
    _iconCache.set(key, url);
  }
  return url;
}

const _markerIconCache: Record<string, { url: string; scaledSize: any; anchor: any }> = {};

function markerIcon(url: string, size: number) {
  let icon = _markerIconCache[url];
  if (!icon) {
    const half = size / 2;
    icon = {
      url,
      scaledSize: { width: size, height: size, equals: () => false } as any,
      anchor: { x: half, y: half, equals: () => false } as any,
    };
    _markerIconCache[url] = icon;
  }
  return icon;
}

const BORDER_FOCUS_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
];

function VillageOverlay({
  villages,
  selectedVillageId,
  showVillages,
  onVillageClick,
}: {
  villages: Village[];
  selectedVillageId: string | null;
  showVillages: boolean;
  onVillageClick: (villageId: string, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const haloLayerRef = useRef<google.maps.Data | null>(null);
  const borderLayerRef = useRef<google.maps.Data | null>(null);
  const clickCbRef = useRef(onVillageClick);
  clickCbRef.current = onVillageClick;
  const loadedVillagesRef = useRef<string>("");

  useEffect(() => {
    if (!map) return;
    if (haloLayerRef.current && borderLayerRef.current) return;

    haloLayerRef.current = new google.maps.Data({ map });
    borderLayerRef.current = new google.maps.Data({ map });

    borderLayerRef.current.addListener("click", (e: google.maps.Data.MouseEvent) => {
      const id = e.feature.getProperty("id") as string;
      const geo = e.feature.getGeometry();
      if (geo && geo.getType() === "Polygon") {
        const path = (geo as google.maps.Data.Polygon).getArray()[0].getArray();
        let sumLat = 0;
        let sumLng = 0;
        path.forEach((pt) => {
          sumLat += pt.lat();
          sumLng += pt.lng();
        });
        clickCbRef.current(id, sumLat / path.length, sumLng / path.length);
      }
    });
  }, [map]);

  useEffect(() => {
    const haloLayer = haloLayerRef.current;
    const borderLayer = borderLayerRef.current;
    if (!haloLayer || !borderLayer) return;

    const key = showVillages ? villages.map((v) => v.id).join(",") : "";
    if (key === loadedVillagesRef.current) return;
    loadedVillagesRef.current = key;

    haloLayer.forEach((f) => haloLayer.remove(f));
    borderLayer.forEach((f) => borderLayer.remove(f));

    if (!showVillages) return;

    villages.forEach((v) => {
      const coords = v.polygon.map(([lng, lat]) => ({ lat, lng }));
      haloLayer.add(
        new google.maps.Data.Feature({
          geometry: new google.maps.Data.Polygon([coords]),
          properties: { id: v.id },
        }),
      );
      borderLayer.add(
        new google.maps.Data.Feature({
          geometry: new google.maps.Data.Polygon([coords]),
          properties: { id: v.id },
        }),
      );
    });
  }, [villages, showVillages]);

  useEffect(() => {
    const haloLayer = haloLayerRef.current;
    const borderLayer = borderLayerRef.current;
    if (!haloLayer || !borderLayer) return;

    haloLayer.setStyle((feature) => {
      const id = feature.getProperty("id");
      const isSelected = id === selectedVillageId;
      return {
        fillOpacity: 0,
        strokeColor: isSelected ? "rgba(244,248,252,0.75)" : "rgba(237,244,250,0.6)",
        strokeOpacity: isSelected ? 0.58 : 0.42,
        strokeWeight: isSelected ? 4.8 : 3.8,
        zIndex: isSelected ? 4 : 2,
        clickable: false,
      };
    });

    borderLayer.setStyle((feature) => {
      const id = feature.getProperty("id");
      const isSelected = id === selectedVillageId;
      return {
        fillColor: "#eef3f6",
        fillOpacity: isSelected ? 0.1 : 0.015,
        strokeColor: isSelected ? "#718aa3" : "#8ca3b8",
        strokeOpacity: isSelected ? 0.9 : 0.68,
        strokeWeight: isSelected ? 2.0 : 1.35,
        zIndex: isSelected ? 6 : 5,
        clickable: true,
        cursor: "pointer",
      };
    });
  }, [selectedVillageId, showVillages]);

  return null;
}

function UserLocationCircle({ lat, lng, accuracy }: { lat: number; lng: number; accuracy: number }) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    const radius = Math.max(80, Math.min(accuracy, 600));

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        center: { lat, lng },
        radius,
        fillColor: "#45d9a8",
        fillOpacity: 0.25,
        strokeColor: "#45d9a8",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter({ lat, lng });
      circleRef.current.setRadius(radius);
    }

    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
  }, [map, lat, lng, accuracy]);

  return null;
}

function LiveCircles({ hotspots }: { hotspots: LiveHotspot[] }) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!map) return;
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    hotspots.forEach((x) => {
      circlesRef.current.push(
        new google.maps.Circle({
          map,
          center: { lat: x.lat, lng: x.lng },
          radius: Math.max(300, Math.min(2000, x.count * 35)),
          fillColor: "#f59e0b",
          fillOpacity: 0.18,
          strokeColor: "#f59e0b",
          strokeOpacity: 0.55,
          strokeWeight: 2,
          clickable: false,
        }),
      );
    });

    return () => {
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, hotspots]);

  return null;
}

const GUAM_LATLNG_BOUNDS = {
  south: GUAM_BOUNDS[0][1],
  west: GUAM_BOUNDS[0][0],
  north: GUAM_BOUNDS[1][1],
  east: GUAM_BOUNDS[1][0],
};

function FitBoundsOnLoad() {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map) return;

    const fit = () => {
      map.fitBounds(GUAM_LATLNG_BOUNDS, GUAM_BOUNDS_PADDING);
      const z = map.getZoom();
      if (z != null) {
        const target = Math.min(12, Math.max(10, z + 0.6));
        map.setZoom(target);
      }
    };

    if (!fitted.current) {
      fit();
      fitted.current = true;
    }

    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [map]);

  return null;
}

function polygonCentroid(ring: [number, number][]): { lat: number; lng: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  area *= 0.5;
  const f = 1 / (6 * area);
  return { lng: cx * f, lat: cy * f };
}

function zoomForBounds(map: google.maps.Map, ring: [number, number][], padding = 60): number {
  const div = map.getDiv();
  const w = div.offsetWidth - padding * 2;
  const h = div.offsetHeight - padding * 2;
  if (w <= 0 || h <= 0) return 13;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const lngSpan = maxLng - minLng;
  const toMercY = (d: number) => Math.log(Math.tan(Math.PI / 4 + (d * Math.PI) / 360));
  const mercSpan = Math.abs(toMercY(maxLat) - toMercY(minLat));

  const zLng = lngSpan > 0 ? Math.log2((w * 360) / (lngSpan * 256)) : 20;
  const zLat = mercSpan > 0 ? Math.log2((h * 2 * Math.PI) / (mercSpan * 256)) : 20;

  return Math.floor(Math.min(zLng, zLat));
}

let _flyId = 0;

function smoothFlyTo(
  map: google.maps.Map,
  target: { lat: number; lng: number },
  targetZoom: number,
) {
  const id = ++_flyId;

  const startCenter = map.getCenter();
  const startZoom = map.getZoom();
  if (!startCenter || startZoom == null) {
    map.moveCamera({ center: target, zoom: targetZoom });
    return;
  }

  const sLat = startCenter.lat();
  const sLng = startCenter.lng();
  const sZ = startZoom;

  const dLat = Math.abs(target.lat - sLat);
  const dLng = Math.abs(target.lng - sLng);
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const durationMs = Math.min(1200, Math.max(700, dist * 1800));

  const start = performance.now();

  (function frame(now: number) {
    if (id !== _flyId) return;
    const t = Math.min(1, (now - start) / durationMs);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    map.moveCamera({
      center: {
        lat: sLat + (target.lat - sLat) * ease,
        lng: sLng + (target.lng - sLng) * ease,
      },
      zoom: sZ + (targetZoom - sZ) * ease,
    });

    if (t < 1) requestAnimationFrame(frame);
  })(performance.now());
}

function FitVillageBounds({
  villages,
  selectedVillageId,
}: {
  villages: Village[];
  selectedVillageId: string | null;
}) {
  const map = useMap();
  const hasInteracted = useRef(false);

  useLayoutEffect(() => {
    if (!map) return;

    if (!selectedVillageId) {
      if (!hasInteracted.current) return;
      const [[w, s], [e, n]] = GUAM_BOUNDS;
      const islandRing: [number, number][] = [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
      ];
      smoothFlyTo(map, DEFAULT_CENTER, zoomForBounds(map, islandRing, GUAM_BOUNDS_PADDING));
      return;
    }

    hasInteracted.current = true;
    const v = villages.find((x) => x.id === selectedVillageId);
    if (!v) return;

    const center = polygonCentroid(v.polygon);
    const zoom = zoomForBounds(map, v.polygon);
    smoothFlyTo(map, center, zoom);
  }, [map, selectedVillageId, villages]);

  return null;
}

function MapControls({
  showVillages,
  onToggleVillages,
}: {
  showVillages: boolean;
  onToggleVillages: () => void;
}) {
  const map = useMap();

  return (
    <div className={styles.mapControls}>
      <button
        className={styles.mapCtrlBtn}
        title="Zoom in"
        onClick={() => map?.setZoom((map.getZoom() ?? 10) + 1)}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="#e8e8e8"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <button
        className={styles.mapCtrlBtn}
        title="Zoom out"
        onClick={() => map?.setZoom((map.getZoom() ?? 10) - 1)}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="#e8e8e8"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <button
        className={styles.mapCtrlBtn}
        title="Center on Guam"
        onClick={() => {
          if (!map) return;
          map.setTilt(0);
          map.setHeading(0);
          map.fitBounds(
            new google.maps.LatLngBounds(
              { lat: GUAM_BOUNDS[0][1], lng: GUAM_BOUNDS[0][0] },
              { lat: GUAM_BOUNDS[1][1], lng: GUAM_BOUNDS[1][0] },
            ),
            GUAM_BOUNDS_PADDING,
          );
        }}
      >
        <img src="/guam.png" alt="Guam" width="20" height="20" style={{ objectFit: "contain" }} />
      </button>

      <button
        className={styles.mapCtrlBtn}
        title={showVillages ? "Hide village borders" : "Show village borders"}
        onClick={onToggleVillages}
        style={{ opacity: showVillages ? 1 : 0.5 }}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="rgba(69,217,168,0.85)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
    </div>
  );
}

let _OverlayClass:
  | (new (
      pos: google.maps.LatLng,
      map: google.maps.Map,
    ) => google.maps.OverlayView & {
      container: HTMLDivElement;
      updatePosition(p: google.maps.LatLng): void;
    })
  | null = null;

function getOverlayClass() {
  if (_OverlayClass) return _OverlayClass;

  class PopupOverlay extends google.maps.OverlayView {
    container: HTMLDivElement;
    private pos: google.maps.LatLng;

    constructor(pos: google.maps.LatLng, map: google.maps.Map) {
      super();
      this.pos = pos;
      this.container = document.createElement("div");
      this.container.style.position = "absolute";
      this.container.style.pointerEvents = "auto";
      this.setMap(map);
    }

    onAdd() {
      this.getPanes()?.floatPane.appendChild(this.container);
    }

    draw() {
      const px = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (!px) return;
      this.container.style.left = `${px.x}px`;
      this.container.style.top = `${px.y}px`;
      this.container.style.transform = "translate(-50%, calc(-100% - 14px))";
    }

    onRemove() {
      this.container.remove();
    }

    updatePosition(pos: google.maps.LatLng) {
      this.pos = pos;
      this.draw();
    }
  }

  _OverlayClass = PopupOverlay as any;
  return _OverlayClass!;
}

function MapPopup({ info, onClose }: { info: NonNullable<PopupInfo>; onClose: () => void }) {
  const map = useMap();
  const overlayRef = useRef<any>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const latLng = useMemo(() => {
    switch (info.kind) {
      case "VILLAGE":
        return new google.maps.LatLng(info.lat, info.lng);
      case "PLACE":
        return new google.maps.LatLng(info.place.lat, info.place.lng);
      case "EVENT":
        return new google.maps.LatLng(info.event.lat, info.event.lng);
      case "USER":
        return new google.maps.LatLng(info.lat, info.lng);
      case "LIVE":
        return new google.maps.LatLng(info.hotspot.lat, info.hotspot.lng);
    }
  }, [info]);

  useEffect(() => {
    if (!map) return;
    const Cls = getOverlayClass();
    const ov = new Cls(latLng, map);
    overlayRef.current = ov;
    setContainer(ov.container);
    return () => {
      ov.setMap(null);
      overlayRef.current = null;
      setContainer(null);
    };
  }, [map, latLng]);

  const content = useMemo(() => {
    switch (info.kind) {
      case "VILLAGE":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.village.name}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>Tap to explore</div>
          </>
        );

      case "PLACE":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.place.name}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.place.category ?? info.place.type} • {info.place.source}
            </div>
          </>
        );

      case "EVENT":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.event.title}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.event.when ?? ""} • {info.event.source}
            </div>
          </>
        );

      case "USER":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>You are here</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.lat.toFixed(5)}, {info.lng.toFixed(5)}
              {typeof info.acc === "number" ? ` • ±${Math.round(info.acc)}m` : ""}
            </div>
          </>
        );

      case "LIVE":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>Live activity</div>
            <div style={{ color: "#c4c4c4", fontSize: 12, marginTop: 2 }}>{info.hotspot.label}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.hotspot.count} recent check-ins (demo)
            </div>
          </>
        );
    }
  }, [info]);

  if (!container) return null;

  return createPortal(
    <>
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 10,
          height: 10,
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderTop: "none",
          borderLeft: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: "10px 32px 10px 12px",
          fontFamily: "var(--sans)",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 20,
            height: 20,
            border: "none",
            background: "transparent",
            color: "#8a8a8a",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
        {content}
      </div>
    </>,
    container,
  );
}

export function HomePage() {
  const villages = useVillages();
  const { musicOn, toggleMusic } = useMusic();

  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("ALL");
  const [search, setSearch] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  const [showPOI, setShowPOI] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showLive, setShowLive] = useState(false);
  const [showVillages, setShowVillages] = useState(true);

  const [selected, setSelected] = useState<Selected>(null);
  const [popupInfo, setPopupInfo] = useState<PopupInfo>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [villageOpen, setVillageOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [savedPoiIds, setSavedPoiIds] = useState<string[]>([]);
  const [itineraries, setItineraries] = useState<ItineraryRow[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItemRow[]>([]);
  const [sharedItinerary, setSharedItinerary] = useState<ItineraryRow | null>(null);
  const [sharedItems, setSharedItems] = useState<ItineraryItemRow[]>([]);
  const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);

  const [deferredVillageId, setDeferredVillageId] = useState<string | null>(null);
  const deferTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { userLoc, userAcc, locateMe } = useUserLocation(villages, (id) => {
    setSelectedVillageId(id);
    setSelected(null);
  });

  const { filteredPlaces, filteredEvents, results } = useFilteredResults(PLACES, EVENTS, {
    selectedVillageId: deferredVillageId,
    category,
    search,
    openNow,
    nearMe,
    userLoc,
  });

  const loadItineraryData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItineraries([]);
      setItineraryItems([]);
      return;
    }

    const { data: itineraryData, error: itineraryError } = await supabase
      .from("itineraries")
      .select("id, title, share_token, is_public")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (itineraryError) {
      console.error("Failed loading itineraries:", itineraryError.message);
      return;
    }

    const rows = (itineraryData ?? []) as ItineraryRow[];
    setItineraries(rows);

    if (rows.length === 0) {
      setItineraryItems([]);
      return;
    }

    const ids = rows.map((x) => x.id);

    const { data: itemData, error: itemError } = await supabase
      .from("itinerary_items")
      .select("id, itinerary_id, poi_id, notes, sort_order, day_number")
      .in("itinerary_id", ids)
      .order("sort_order", { ascending: true });

    if (itemError) {
      console.error("Failed loading itinerary items:", itemError.message);
      return;
    }

    setItineraryItems((itemData ?? []) as ItineraryItemRow[]);
  }, []);

  const loadSharedItinerary = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("share");

    if (!token) {
      setSharedItinerary(null);
      setSharedItems([]);
      return;
    }

    const { data: itinerary, error } = await supabase
      .from("itineraries")
      .select("id, title, share_token, is_public")
      .eq("share_token", token)
      .eq("is_public", true)
      .single();

    if (error || !itinerary) {
      console.error("Failed loading shared itinerary:", error?.message);
      setSharedItinerary(null);
      setSharedItems([]);
      return;
    }

    setSharedItinerary(itinerary as ItineraryRow);
    setActiveItineraryId(null);

    const { data: items, error: itemError } = await supabase
      .from("itinerary_items")
      .select("id, itinerary_id, poi_id, notes, sort_order, day_number")
      .eq("itinerary_id", itinerary.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      console.error("Failed loading shared items:", itemError.message);
      setSharedItems([]);
      return;
    }

    setSharedItems((items ?? []) as ItineraryItemRow[]);
  }, []);

  useEffect(() => {
    async function loadSavedPois() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSavedPoiIds([]);
        return;
      }

      const { data, error } = await supabase
        .from("saved_pois")
        .select("poi_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed loading saved POIs:", error.message);
        return;
      }

      setSavedPoiIds((data ?? []).map((row) => row.poi_id));
    }

    loadSavedPois();
    loadItineraryData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSavedPois();
      loadItineraryData();
    });

    return () => subscription.unsubscribe();
  }, [loadItineraryData]);

  useEffect(() => {
    loadSharedItinerary();
  }, [loadSharedItinerary]);

  const selectedVillageName = useMemo(() => {
    if (!deferredVillageId) return "All Guam";
    return villages.find((v) => v.id === deferredVillageId)?.name ?? "All Guam";
  }, [deferredVillageId, villages]);

  const villagePlaces = useMemo(() => {
    if (!deferredVillageId) return [];

    const normalize = (v: string | null | undefined) =>
      (v ?? "").toLowerCase().replace(/[^a-z]/g, "");

    return PLACES.filter((p) => normalize(p.villageId) === normalize(deferredVillageId));
  }, [deferredVillageId]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = PLACES.find((x) => x.id === selected.id);
      return p ? { kind: "PLACE" as const, p } : null;
    }
    const e = EVENTS.find((x) => x.id === selected.id);
    return e ? { kind: "EVENT" as const, e } : null;
  }, [selected]);

  const selectedPlace = useMemo(() => {
    return selectedDetail?.kind === "PLACE" ? selectedDetail.p : null;
  }, [selectedDetail]);

  const selectedPlaceSaved = !!(selectedPlace && savedPoiIds.includes(selectedPlace.id));

  const highlightedPoiIds = useMemo(() => {
    const ids = new Set<string>();

    if (activeItineraryId) {
      itineraryItems
        .filter((x) => x.itinerary_id === activeItineraryId)
        .forEach((x) => ids.add(x.poi_id));
    } else if (sharedItinerary) {
      sharedItems.forEach((x) => ids.add(x.poi_id));
    }

    return ids;
  }, [activeItineraryId, itineraryItems, sharedItinerary, sharedItems]);

  const toggleSavePoi = useCallback(async (poiId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please sign in first.");
      return;
    }

    const isSaved = savedPoiIds.includes(poiId);

    if (isSaved) {
      const { error } = await supabase
        .from("saved_pois")
        .delete()
        .eq("user_id", user.id)
        .eq("poi_id", poiId);

      if (error) {
        alert(error.message);
        return;
      }

      setSavedPoiIds((prev) => prev.filter((id) => id !== poiId));
    } else {
      const { error } = await supabase.from("saved_pois").insert({
        user_id: user.id,
        poi_id: poiId,
      });

      if (error) {
        alert(error.message);
        return;
      }

      setSavedPoiIds((prev) => [...prev, poiId]);
    }
  }, [savedPoiIds]);

  const createItinerary = useCallback(async (title: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please sign in first.");
      return;
    }

    const { error } = await supabase.from("itineraries").insert({
      user_id: user.id,
      title,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadItineraryData();
  }, [loadItineraryData]);

  const addPlaceToItinerary = useCallback(async (itineraryId: string, poiId: string) => {
    const existing = itineraryItems
      .filter((x) => x.itinerary_id === itineraryId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const nextSort = existing.length;

    const { error } = await supabase.from("itinerary_items").insert({
      itinerary_id: itineraryId,
      poi_id: poiId,
      sort_order: nextSort,
      day_number: 1,
    });

    if (error) {
      if (!error.message.toLowerCase().includes("duplicate")) {
        alert(error.message);
      }
      return;
    }

    setActiveItineraryId(itineraryId);
    await loadItineraryData();
  }, [itineraryItems, loadItineraryData]);

  const removeItineraryItem = useCallback(async (itemId: number) => {
    const { error } = await supabase
      .from("itinerary_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadItineraryData();
  }, [loadItineraryData]);

  const moveItineraryItem = useCallback(async (itemId: number, dir: "up" | "down") => {
    const item = itineraryItems.find((x) => x.id === itemId);
    if (!item) return;

    const list = itineraryItems
      .filter((x) => x.itinerary_id === item.itinerary_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = list.findIndex((x) => x.id === itemId);
    const swapIndex = dir === "up" ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= list.length) return;

    const current = list[index];
    const other = list[swapIndex];

    const currentSort = current.sort_order;
    const otherSort = other.sort_order;

    const [a, b] = await Promise.all([
      supabase.from("itinerary_items").update({ sort_order: otherSort }).eq("id", current.id),
      supabase.from("itinerary_items").update({ sort_order: currentSort }).eq("id", other.id),
    ]);

    if (a.error || b.error) {
      alert(a.error?.message ?? b.error?.message ?? "Failed to reorder itinerary item.");
      return;
    }

    await loadItineraryData();
  }, [itineraryItems, loadItineraryData]);

  const updateItineraryItem = useCallback(async (
    itemId: number,
    patch: { notes?: string; day_number?: number },
  ) => {
    const { error } = await supabase
      .from("itinerary_items")
      .update(patch)
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadItineraryData();
  }, [loadItineraryData]);

  const toggleItineraryPublic = useCallback(async (itineraryId: string, nextValue: boolean) => {
    const { error } = await supabase
      .from("itineraries")
      .update({ is_public: nextValue })
      .eq("id", itineraryId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadItineraryData();
    await loadSharedItinerary();
  }, [loadItineraryData, loadSharedItinerary]);

  const copyItinerarySummary = useCallback(async (itineraryId: string) => {
    const itinerary = itineraries.find((x) => x.id === itineraryId);
    if (!itinerary) return;

    const items = itineraryItems
      .filter((x) => x.itinerary_id === itineraryId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const lines = [`${itinerary.title}`, ""];

    items.forEach((item) => {
      const place = PLACES.find((p) => p.id === item.poi_id);
      lines.push(`Day ${item.day_number}: ${place?.name ?? item.poi_id}`);
      if (item.notes?.trim()) lines.push(`Notes: ${item.notes.trim()}`);
      lines.push("");
    });

    await navigator.clipboard.writeText(lines.join("\n"));
    alert("Itinerary summary copied.");
  }, [itineraries, itineraryItems]);

  const selectVillage = useCallback((id: string | null) => {
    setSelectedVillageId(id);
    setSelected(null);
    setPopupInfo(null);
    clearTimeout(deferTimeoutRef.current);
    deferTimeoutRef.current = setTimeout(() => setDeferredVillageId(id), 60);
  }, []);

  const onVillageClick = useCallback(
    (villageId: string) => {
      selectVillage(villageId);
      const v = villages.find((x) => x.id === villageId);
      if (!v) return;

      const center = polygonCentroid(v.polygon);
      setPopupInfo({
        kind: "VILLAGE",
        village: v,
        lng: center.lng,
        lat: center.lat,
      });
    },
    [villages, selectVillage],
  );

  const reset = useCallback(() => {
    setSelectedVillageId(null);
    setCategory("ALL");
    setSearch("");
    setOpenNow(false);
    setNearMe(false);
    setSelected(null);
    setPopupInfo(null);
    clearTimeout(deferTimeoutRef.current);
    setDeferredVillageId(null);
  }, []);

  const onSelectResult = useCallback((kind: "PLACE" | "EVENT", id: string) => {
    setSelected({ kind, id });
  }, []);

  const onSelectPlace = useCallback((id: string) => {
    setSelected({ kind: "PLACE", id });
  }, []);

  const toggleDetails = useCallback(() => setDetailsOpen((o) => !o), []);
  const toggleVillage = useCallback(() => setVillageOpen((o) => !o), []);
  const toggleDropdown = useCallback(() => setDropdownOpen((o) => !o), []);
  const toggleShowVillages = useCallback(() => setShowVillages((v) => !v), []);
  const resetToAll = useCallback(() => selectVillage(null), [selectVillage]);
  const borderFocusMode = false;

  useEffect(() => {
    if (borderFocusMode) setPopupInfo(null);
  }, [borderFocusMode]);

  return (
    <div className={styles.page}>
      <div className={styles.main}>
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

          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <GoogleMap
              defaultCenter={{ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }}
              defaultZoom={10}
              mapTypeId="roadmap"
              colorScheme="LIGHT"
              gestureHandling="greedy"
              disableDefaultUI={true}
              styles={borderFocusMode ? BORDER_FOCUS_MAP_STYLE : null}
              style={{ width: "100%", height: "100%" }}
            >
              <FitBoundsOnLoad />
              <FitVillageBounds villages={villages} selectedVillageId={selectedVillageId} />
              <MapControls showVillages={showVillages} onToggleVillages={toggleShowVillages} />

              <VillageOverlay
                villages={villages}
                selectedVillageId={selectedVillageId}
                showVillages={showVillages}
                onVillageClick={onVillageClick}
              />

              {!borderFocusMode && userLoc && userAcc != null && (
                <UserLocationCircle lat={userLoc.lat} lng={userLoc.lng} accuracy={userAcc} />
              )}

              {!borderFocusMode && userLoc && (
                <Marker
                  position={{ lat: userLoc.lat, lng: userLoc.lng }}
                  icon={markerIcon(dotIcon("#45d9a8", 14, "white"), 14)}
                  onClick={() =>
                    setPopupInfo({
                      kind: "USER",
                      lng: userLoc.lng,
                      lat: userLoc.lat,
                      acc: userAcc,
                    })
                  }
                />
              )}

              {!borderFocusMode &&
                showPOI &&
                filteredPlaces.map((p) => {
                  const highlighted = highlightedPoiIds.has(p.id);

                  return (
                    <div key={p.id}>


                      <Marker
                        position={{ lat: p.lat, lng: p.lng }}
                        icon={markerIcon(
                          emojiIcon(
                            placeEmoji(p.category ?? p.type),
                            highlighted ? "rgba(69,217,168,0.9)" : "rgba(255,255,255,0.18)",
                            highlighted ? "rgba(69,217,168,0.18)" : "rgba(20,20,20,0.85)",
                          ),
                          highlighted ? 36 : 30,
                        )}
                        onClick={() => {
                          setSelected({ kind: "PLACE", id: p.id });
                          setPopupInfo({ kind: "PLACE", place: p });
                        }}
                      />
                    </div>
                  );
                })}

              {!borderFocusMode &&
                showEvents &&
                filteredEvents.map((ev) => (
                  <Marker
                    key={ev.id}
                    position={{ lat: ev.lat, lng: ev.lng }}
                    icon={markerIcon(
                      emojiIcon(
                        eventEmoji(ev.status),
                        ev.status === "VERIFIED"
                          ? "rgba(69,217,168,0.45)"
                          : "rgba(245,158,11,0.45)",
                        ev.status === "VERIFIED"
                          ? "rgba(69,217,168,0.12)"
                          : "rgba(245,158,11,0.12)",
                      ),
                      30,
                    )}
                    onClick={() => {
                      setSelected({ kind: "EVENT", id: ev.id });
                      setPopupInfo({ kind: "EVENT", event: ev });
                    }}
                  />
                ))}

              {!borderFocusMode && showLive && <LiveCircles hotspots={LIVE} />}

              {!borderFocusMode &&
                showLive &&
                LIVE.map((x) => (
                  <Marker
                    key={x.id}
                    position={{ lat: x.lat, lng: x.lng }}
                    icon={markerIcon(
                      dotIcon("rgba(245,158,11,0.8)", 10, "rgba(245,158,11,1)"),
                      10,
                    )}
                    onClick={() => setPopupInfo({ kind: "LIVE", hotspot: x })}
                  />
                ))}

              {!borderFocusMode && popupInfo && (
                <MapPopup info={popupInfo} onClose={() => setPopupInfo(null)} />
              )}
            </GoogleMap>
          </APIProvider>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleBlock}>
              <div className={styles.brand}>
                GuamRadar <span className={styles.badgeWip}>WIP</span>
              </div>
              <div className={styles.sidebarSubtitle}>Discover Guam village by village</div>
            </div>

            <button
              className={`${styles.pill} ${musicOn ? styles.pillActive : ""}`}
              onClick={toggleMusic}
              title="Toggle background music"
            >
              {musicOn ? "🔊 Music: ON" : "🔇 Music: OFF"}
            </button>
          </div>

          <AuthCard onSignedIn={loadItineraryData} />

          {sharedItinerary && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.bigTextSmall}>Shared Itinerary</div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.detailTitle}>{sharedItinerary.title}</div>

                {sharedItems.length === 0 ? (
                  <div className={styles.muted}>No places.</div>
                ) : (
                  sharedItems.map((item) => {
                    const place = PLACES.find((p) => p.id === item.poi_id);

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "8px 0",
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div>
                          Day {item.day_number} • {place?.name ?? item.poi_id}
                        </div>
                        <div className={styles.muted}>{place?.type ?? ""}</div>
                        {item.notes && <div className={styles.muted}>{item.notes}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <SavedPoisCard
            savedPoiIds={savedPoiIds}
            allPlaces={PLACES}
            onSelectPlace={onSelectPlace}
            onRemoveSaved={toggleSavePoi}
          />

          <div className={`${styles.card} ${styles.primaryCard}`}>
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
                  {CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      className={`${styles.chip} ${category === c.value ? styles.chipActive : ""}`}
                      onClick={() => setCategory(c.value)}
                    >
                      {c.label}
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

              <ResultsList results={results} userLoc={userLoc} onSelect={onSelectResult} />
            </div>
          </div>

          <DetailsPanel
            selectedDetail={selectedDetail}
            isOpen={detailsOpen}
            onToggle={toggleDetails}
            canSave={selectedDetail?.kind === "PLACE"}
            isSaved={selectedPlaceSaved}
            onToggleSave={() => {
              if (selectedPlace) toggleSavePoi(selectedPlace.id);
            }}
          />

          <ItineraryCard
            currentPlace={selectedPlace}
            itineraries={itineraries}
            itineraryItems={itineraryItems}
            allPlaces={PLACES}
            activeItineraryId={activeItineraryId}
            onSetActiveItinerary={setActiveItineraryId}
            onCreateItinerary={createItinerary}
            onAddPlaceToItinerary={addPlaceToItinerary}
            onRemoveItem={removeItineraryItem}
            onMoveItem={moveItineraryItem}
            onTogglePublic={toggleItineraryPublic}
            onUpdateItem={updateItineraryItem}
            onCopySummary={copyItinerarySummary}
          />

          <VillageBrowser
            villages={villages}
            selectedVillageId={selectedVillageId}
            villagePlaces={villagePlaces}
            isOpen={villageOpen}
            dropdownOpen={dropdownOpen}
            onToggle={toggleVillage}
            onSelectVillage={selectVillage}
            onSelectPlace={onSelectPlace}
            onDropdownToggle={toggleDropdown}
            onResetToAll={resetToAll}
          />
        </div>
      </div>
    </div>
  );
}