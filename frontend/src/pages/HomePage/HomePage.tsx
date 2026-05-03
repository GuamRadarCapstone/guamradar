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
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  type Language,
  type TranslationStatus,
  categoryLabel,
  getStoredLanguage,
  t,
  translateEventsToLanguage,
  translatePlacesToLanguage,
  translateVillagesToLanguage,
} from "../../lib/i18n";

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

const BASE_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const MAP_THEMES: Record<string, { name: string; styles: google.maps.MapTypeStyle[] }> = {
  default: { name: "Default", styles: BASE_MAP_STYLE },
  dark: {
    name: "Dark",
    styles: [
      ...BASE_MAP_STYLE,
      { elementType: "geometry", stylers: [{ color: "#212121" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#212121" }] },
    ],
  },
  night: {
    name: "Night",
    styles: [
      ...BASE_MAP_STYLE,
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    ],
  },
};

const BORDER_FOCUS_MAP_STYLE: google.maps.MapTypeStyle[] = [
  ...BASE_MAP_STYLE,
  { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
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

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<google.maps.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}


function guamZoomForSize(h: number, w: number): number {
  const latSpan = GUAM_BOUNDS[1][1] - GUAM_BOUNDS[0][1];
  const lngSpan = GUAM_BOUNDS[1][0] - GUAM_BOUNDS[0][0];
  const zoomLat = Math.log2((h * 360) / (latSpan * 256));
  const zoomLng = Math.log2((w * 360) / (lngSpan * 256));
  return Math.min(zoomLat, zoomLng) - 0.15;
}

const INITIAL_ZOOM = guamZoomForSize(window.innerHeight, window.innerWidth);

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
  lang,
  showVillages,
  onToggleVillages,
  showMarkers,
  onToggleMarkers,
  onLocateMe,
  settingsOpen,
  onToggleSettings,
  settingsPopup,
}: {
  lang: Language;
  showVillages: boolean;
  onToggleVillages: () => void;
  showMarkers: boolean;
  onToggleMarkers: () => void;
  onLocateMe: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  settingsPopup: React.ReactNode;
}) {
  return (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, width: 38 }}>
      <div className={styles.mapControls}>
        <button
          className={styles.mapCtrlBtn}
          title={t(lang, "myLocation")}
          onClick={onLocateMe}
        >
          <svg viewBox="-1 -1 26 26" width="18" height="18" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>

        <button
          className={styles.mapCtrlBtn}
          title={showMarkers ? t(lang, "hideMarkers") : t(lang, "showMarkers")}
          onClick={onToggleMarkers}
          style={{ opacity: showMarkers ? 1 : 0.5 }}
        >
          <svg viewBox="-1 -1 26 26" width="18" height="18" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </button>

        <button
          className={styles.mapCtrlBtn}
          title={showVillages ? t(lang, "hideVillageBorders") : t(lang, "showVillageBorders")}
          onClick={onToggleVillages}
          style={{ opacity: showVillages ? 1 : 0.5 }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(69,217,168,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>

      </div>

      <div className={styles.mapControls} style={{ marginTop: 6 }}>
        <button
          className={styles.mapCtrlBtn}
          title={t(lang, "settings")}
          onClick={onToggleSettings}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={settingsOpen ? "rgba(69,217,168,1)" : "#e8e8e8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

        <div className={`${styles.settingsPopup} ${settingsOpen ? styles.settingsPopupOpen : ""}`} style={{
          position: "absolute",
          top: 0,
          left: "calc(100% + 8px)",
          background: "rgba(15,28,30,0.94)",
          backdropFilter: "blur(12px)",
          borderRadius: 10,
          padding: "12px 14px",
          minWidth: 160,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
          whiteSpace: "nowrap",
        }}>
          {settingsPopup}
        </div>
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

function MapPopup({ lang, info, onClose }: { lang: Language; info: NonNullable<PopupInfo>; onClose: () => void }) {
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
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{t(lang, "tapToExplore")}</div>
          </>
        );

      case "PLACE":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.place.name}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {categoryLabel(info.place.category ?? info.place.type, lang)} • {info.place.source}
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
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{t(lang, "youAreHere")}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.lat.toFixed(5)}, {info.lng.toFixed(5)}
              {typeof info.acc === "number" ? ` • ±${Math.round(info.acc)}m` : ""}
            </div>
          </>
        );

      case "LIVE":
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{t(lang, "liveActivity")}</div>
            <div style={{ color: "#c4c4c4", fontSize: 12, marginTop: 2 }}>{info.hotspot.label}</div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {info.hotspot.count} {t(lang, "recentCheckinsDemo")}
            </div>
          </>
        );
    }
  }, [info, lang]);

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
  const [lang, setLang] = useState<Language>(getStoredLanguage);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>("idle");
  const [displayPlaces, setDisplayPlaces] = useState<Place[]>(PLACES);
  const [displayEvents, setDisplayEvents] = useState<EventItem[]>(EVENTS);
  const [displayVillages, setDisplayVillages] = useState<Village[]>(villages);

  const mapRef = useRef<google.maps.Map | null>(null);
  const centerOnGuam = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setTilt(0);
    map.setHeading(0);
    const div = map.getDiv();
    const zoom = div?.clientHeight
      ? guamZoomForSize(div.clientHeight, div.clientWidth)
      : INITIAL_ZOOM;
    smoothFlyTo(map, DEFAULT_CENTER, zoom);
  }, []);

  const [showPOI, setShowPOI] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showLive] = useState(false);
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

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

    let cancelled = false;

    async function applyLanguage() {
      if (lang === "en") {
        setDisplayPlaces(PLACES);
        setDisplayEvents(EVENTS);
        setDisplayVillages(villages);
        setTranslationStatus("idle");
        return;
      }

      setTranslationStatus("loading");

      try {
        const [translatedPlaces, translatedEvents, translatedVillages] = await Promise.all([
          translatePlacesToLanguage(PLACES, lang),
          translateEventsToLanguage(EVENTS, lang),
          translateVillagesToLanguage(villages, lang),
        ]);

        if (cancelled) return;
        setDisplayPlaces(translatedPlaces);
        setDisplayEvents(translatedEvents);
        setDisplayVillages(translatedVillages);
        setTranslationStatus("ready");
      } catch (error) {
        console.error("Translation failed:", error);
        if (cancelled) return;
        setDisplayPlaces(PLACES);
        setDisplayEvents(EVENTS);
        setDisplayVillages(villages);
        setTranslationStatus("error");
      }
    }

    applyLanguage();

    return () => {
      cancelled = true;
    };
  }, [lang, villages]);

  const { filteredPlaces, filteredEvents, results } = useFilteredResults(displayPlaces, displayEvents, {
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
    if (!deferredVillageId) return t(lang, "explore");
    return displayVillages.find((v) => v.id === deferredVillageId)?.name ?? t(lang, "explore");
  }, [deferredVillageId, displayVillages, lang]);

  const villagePlaces = useMemo(() => {
    if (!deferredVillageId) return [];

    const normalize = (v: string | null | undefined) =>
      (v ?? "").toLowerCase().replace(/[^a-z]/g, "");

    return displayPlaces.filter((p) => normalize(p.villageId) === normalize(deferredVillageId));
  }, [deferredVillageId, displayPlaces]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = displayPlaces.find((x) => x.id === selected.id);
      return p ? { kind: "PLACE" as const, p } : null;
    }
    const e = displayEvents.find((x) => x.id === selected.id);
    return e ? { kind: "EVENT" as const, e } : null;
  }, [selected, displayPlaces, displayEvents]);

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
      const place = displayPlaces.find((p) => p.id === item.poi_id);
      lines.push(`Day ${item.day_number}: ${place?.name ?? item.poi_id}`);
      if (item.notes?.trim()) lines.push(`Notes: ${item.notes.trim()}`);
      lines.push("");
    });

    await navigator.clipboard.writeText(lines.join("\n"));
    alert("Itinerary summary copied.");
  }, [itineraries, itineraryItems, displayPlaces]);

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
  const [mapTheme, setMapTheme] = useState("default");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "explore" | "villages" | "profile">("map");
  const prevTabRef = useRef<"explore" | "villages" | "profile">("explore");
  if (activeTab !== "map") prevTabRef.current = activeTab;
  const panelTab = activeTab !== "map" ? activeTab : prevTabRef.current;
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    if (borderFocusMode) setPopupInfo(null);
  }, [borderFocusMode]);

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.mapWrap}>
          <div className={styles.mapHud} />

          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <GoogleMap
              defaultCenter={{ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }}
              defaultZoom={INITIAL_ZOOM}
              mapTypeId="roadmap"
              colorScheme="LIGHT"
              gestureHandling="greedy"
              disableDefaultUI={true}
              isFractionalZoomEnabled={true}
              styles={borderFocusMode ? BORDER_FOCUS_MAP_STYLE : (MAP_THEMES[mapTheme]?.styles ?? BASE_MAP_STYLE)}
              style={{ width: "100%", height: "100%" }}
            >
              <MapRefCapture mapRef={mapRef} />
              <FitVillageBounds villages={villages} selectedVillageId={selectedVillageId} />
              <MapControls
                lang={lang}
                showVillages={showVillages}
                onToggleVillages={toggleShowVillages}
                showMarkers={showPOI || showEvents}
                onToggleMarkers={() => {
                  const next = !(showPOI || showEvents);
                  setShowPOI(next);
                  setShowEvents(next);
                }}
                onLocateMe={locateMe}
                settingsOpen={settingsOpen}
                onToggleSettings={() => setSettingsOpen((o) => !o)}
                settingsPopup={<>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                    {t(lang, "mapTheme")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(MAP_THEMES).map(([key]) => (
                      <button
                        key={key}
                        onClick={() => setMapTheme(key)}
                        style={{
                          padding: "6px 12px",
                          fontSize: 13,
                          fontWeight: mapTheme === key ? 600 : 400,
                          border: mapTheme === key ? "1px solid rgba(43,181,160,0.5)" : "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 6,
                          background: mapTheme === key ? "rgba(43,181,160,0.12)" : "transparent",
                          color: mapTheme === key ? "var(--accent-light)" : "var(--text-secondary)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        {t(lang, key)}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                      {t(lang, "language")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setLang(option.value)}
                          style={{
                            width: "100%",
                            padding: "6px 12px",
                            fontSize: 13,
                            fontWeight: lang === option.value ? 600 : 400,
                            border: lang === option.value ? "1px solid rgba(43,181,160,0.5)" : "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 6,
                            background: lang === option.value ? "rgba(43,181,160,0.12)" : "transparent",
                            color: lang === option.value ? "var(--accent-light)" : "var(--text-secondary)",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {translationStatus === "loading" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                        {t(lang, "translationLoading")}
                      </div>
                    )}
                    {translationStatus === "error" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#fca5a5" }}>
                        {t(lang, "translationError")}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                      {t(lang, "music")}
                    </div>
                    <button
                      onClick={toggleMusic}
                      style={{
                        width: "100%",
                        padding: "6px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        border: musicOn ? "1px solid rgba(43,181,160,0.5)" : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 6,
                        background: musicOn ? "rgba(43,181,160,0.12)" : "transparent",
                        color: musicOn ? "var(--accent-light)" : "var(--text-secondary)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                    >
                      {musicOn ? t(lang, "on") : t(lang, "off")}
                    </button>
                  </div>
                </>}
              />

              <VillageOverlay
                villages={displayVillages}
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
                <MapPopup lang={lang} info={popupInfo} onClose={() => setPopupInfo(null)} />
              )}
            </GoogleMap>
          </APIProvider>

        </div>

        {/* Safe area container for UI overlays */}
        <div className={styles.safeArea}>
        {/* Floating panel — shown when a non-map tab is active */}
          <div className={`${styles.sidebarPanel} ${activeTab !== "map" ? styles.sidebarPanelOpen : ""}`}>
            <div key={panelTab} className={styles.panelContent}>
            {panelTab === "explore" && (
              <>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className={styles.bigText}>{selectedVillageName}</div>
                    <div className={styles.badgeGood}>WIP</div>
                  </div>

                  <input
                    className={styles.input}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t(lang, "searchPlaceholder")}
                    style={{ marginBottom: 10 }}
                  />

                  <div className={styles.chipRow}>
                    {CATEGORY_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        className={`${styles.chip} ${category === c.value ? styles.chipActive : ""}`}
                        onClick={() => setCategory(c.value)}
                      >
                        {categoryLabel(c.value, lang)}
                      </button>
                    ))}
                  </div>

                  <div className={styles.rowBetween} style={{ marginTop: 10 }}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={openNow}
                        onChange={(e) => setOpenNow(e.target.checked)}
                      />{" "}
                      {t(lang, "openNow")}
                    </label>

                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={nearMe}
                        onChange={(e) => setNearMe(e.target.checked)}
                      />{" "}
                      {t(lang, "nearMe")}
                    </label>

                    <button className={styles.btn} onClick={reset}>
                      {t(lang, "reset")}
                    </button>
                  </div>

                  {nearMe && !userLoc && (
                    <div className={styles.notice} style={{ marginTop: 8 }}>
                      {t(lang, "nearMeNotice")}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                  <div className={styles.rowBetween} style={{ marginBottom: 8 }}>
                    <span className={styles.tinyMuted}>{t(lang, "results")}</span>
                    <span className={styles.tinyMuted}>{results.length} {t(lang, "items")}</span>
                  </div>

                  <ResultsList results={results} userLoc={userLoc} onSelect={onSelectResult} lang={lang} />
                </div>
              </>
            )}

            {panelTab === "villages" && (
              <>
                <VillageBrowser
                  lang={lang}
                  villages={displayVillages}
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

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <DetailsPanel
                    lang={lang}
                    selectedDetail={selectedDetail}
                    isOpen={detailsOpen}
                    onToggle={toggleDetails}
                    canSave={selectedDetail?.kind === "PLACE"}
                    isSaved={selectedPlaceSaved}
                    onToggleSave={() => {
                      if (selectedPlace) toggleSavePoi(selectedPlace.id);
                    }}
                  />
                </div>
              </>
            )}

            {panelTab === "profile" && (
              <>
                <AuthCard lang={lang} onSignedIn={loadItineraryData} onAuthChange={setIsSignedIn} />

                {isSignedIn && (
                  <>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 14, paddingTop: 14 }}>
                      <SavedPoisCard
                        lang={lang}
                        savedPoiIds={savedPoiIds}
                        allPlaces={displayPlaces}
                        onSelectPlace={onSelectPlace}
                        onRemoveSaved={toggleSavePoi}
                      />
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 14, paddingTop: 14 }}>
                      <ItineraryCard
                        lang={lang}
                        currentPlace={selectedPlace}
                        itineraries={itineraries}
                        itineraryItems={itineraryItems}
                        allPlaces={displayPlaces}
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
                    </div>

                    {sharedItinerary && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 14, paddingTop: 14 }}>
                        <div className={styles.bigTextSmall} style={{ marginBottom: 10 }}>{t(lang, "sharedItinerary")}</div>
                        <div className={styles.detailTitle}>{sharedItinerary.title}</div>

                        {sharedItems.length === 0 ? (
                          <div className={styles.muted}>{t(lang, "noPlaces")}</div>
                        ) : (
                          sharedItems.map((item) => {
                            const place = displayPlaces.find((p) => p.id === item.poi_id);
                            return (
                              <div
                                key={item.id}
                                style={{
                                  padding: "8px 0",
                                  borderTop: "1px solid rgba(255,255,255,0.04)",
                                }}
                              >
                                <div>{t(lang, "day")} {item.day_number} • {place?.name ?? item.poi_id}</div>
                                <div className={styles.muted}>{place?.type ?? ""}</div>
                                {item.notes && <div className={styles.muted}>{item.notes}</div>}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            </div>
          </div>

        {/* Bottom navigation bar */}
        <div className={styles.bottomNav}>
          {([
            { key: "map", labelKey: "map", icon: (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            )},
            { key: "explore", labelKey: "explore", icon: (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3,11 22,2 13,21 11,13" />
              </svg>
            )},
            { key: "villages", labelKey: "villages", icon: (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )},
            { key: "profile", labelKey: "profile", icon: (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )},
          ] as const).map((tab) => (
            <button
              key={tab.key}
              className={`${styles.navItem} ${activeTab === tab.key ? styles.navItemActive : ""}`}
              onClick={() => {
                if (tab.key === "map") {
                  setActiveTab("map");
                  centerOnGuam();
                } else {
                  setActiveTab(activeTab === tab.key ? "map" : tab.key);
                }
              }}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              <span className={styles.navLabel}>{t(lang, tab.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}