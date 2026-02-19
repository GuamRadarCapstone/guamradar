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

import { DEFAULT_CENTER, GUAM_BOUNDS, GUAM_BOUNDS_PADDING } from "../../lib/constants";
import { placeEmoji, eventEmoji } from "../../lib/ui";

import type { Village, Place, EventItem, LiveHotspot } from "../../types/data";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type Selected = { kind: "PLACE"; id: string } | { kind: "EVENT"; id: string } | null;

type PopupInfo =
  | { kind: "VILLAGE"; village: Village; lng: number; lat: number }
  | { kind: "PLACE"; place: Place }
  | { kind: "EVENT"; event: EventItem }
  | { kind: "USER"; lng: number; lat: number; acc: number | null }
  | { kind: "LIVE"; hotspot: LiveHotspot }
  | null;

/* ─── SVG icon helpers (memoized — avoid regenerating data URIs every render) ─── */
const _iconCache = new Map<string, string>();

function dotIcon(color: string, size: number, borderColor = "white") {
  const key = `dot:${color}:${size}:${borderColor}`;
  let url = _iconCache.get(key);
  if (!url) {
    url = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}" stroke="${borderColor}" stroke-width="2"/>` +
      `</svg>`
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
    url = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
      `<rect x=".5" y=".5" width="${s - 1}" height="${s - 1}" rx="6" ry="6" fill="${bg}" stroke="${border}" stroke-width="1"/>` +
      `<text x="${s / 2}" y="${s / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-size="16">${emoji}</text>` +
      `</svg>`
    );
    _iconCache.set(key, url);
  }
  return url;
}

/* ─── Stable marker icon objects (avoid re-creating on every render) ─── */
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

/* ─── Dark map style ─── */
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

/* ─── Village overlay (rendered inside <Map>) ─── */
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
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const clickCbRef = useRef(onVillageClick);
  clickCbRef.current = onVillageClick;
  const loadedVillagesRef = useRef<string>(""); // track which village set is loaded

  // One-time: create data layer + click listener
  useEffect(() => {
    if (!map) return;
    if (dataLayerRef.current) return;

    dataLayerRef.current = new google.maps.Data({ map });
    dataLayerRef.current.addListener("click", (e: google.maps.Data.MouseEvent) => {
      const id = e.feature.getProperty("id") as string;
      const geo = e.feature.getGeometry();
      if (geo && geo.getType() === "Polygon") {
        const path = (geo as google.maps.Data.Polygon).getArray()[0].getArray();
        let sumLat = 0, sumLng = 0;
        path.forEach((pt) => { sumLat += pt.lat(); sumLng += pt.lng(); });
        clickCbRef.current(id, sumLat / path.length, sumLng / path.length);
      }
    });
  }, [map]);

  // Add/remove features only when villages data or visibility changes
  useEffect(() => {
    const layer = dataLayerRef.current;
    if (!layer) return;

    // Build a fingerprint to detect actual data changes
    const key = showVillages ? villages.map((v) => v.id).join(",") : "";
    if (key === loadedVillagesRef.current) return;
    loadedVillagesRef.current = key;

    layer.forEach((f) => layer.remove(f));

    if (!showVillages) return;

    villages.forEach((v) => {
      const coords = v.polygon.map(([lng, lat]) => ({ lat, lng }));
      layer.add(
        new google.maps.Data.Feature({
          geometry: new google.maps.Data.Polygon([coords]),
          properties: { id: v.id, name: v.name },
        }),
      );
    });
  }, [villages, showVillages]);

  // Update style only — cheap operation, no geometry rebuild
  useEffect(() => {
    const layer = dataLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature) => {
      const id = feature.getProperty("id");
      const isSelected = id === selectedVillageId;
      return {
        fillColor: "#34d399",
        fillOpacity: isSelected ? 0.25 : 0,
        strokeColor: isSelected ? "#34d399" : "rgba(0,0,0,0.35)",
        strokeWeight: isSelected ? 2.5 : 1.25,
        clickable: true,
        cursor: "pointer",
      };
    });
  }, [selectedVillageId, showVillages]);

  return null;
}

/* ─── User location circle ─── */
function UserLocationCircle({ lat, lng, accuracy }: { lat: number; lng: number; accuracy: number }) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    const radius = Math.max(80, Math.min(accuracy, 600));

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map, center: { lat, lng }, radius,
        fillColor: "#45d9a8", fillOpacity: 0.25,
        strokeColor: "#45d9a8", strokeOpacity: 0.9, strokeWeight: 2,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter({ lat, lng });
      circleRef.current.setRadius(radius);
    }

    return () => { circleRef.current?.setMap(null); circleRef.current = null; };
  }, [map, lat, lng, accuracy]);

  return null;
}

/* ─── Live hotspot circles ─── */
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
          map, center: { lat: x.lat, lng: x.lng },
          radius: Math.max(300, Math.min(2000, x.count * 35)),
          fillColor: "#f59e0b", fillOpacity: 0.18,
          strokeColor: "#f59e0b", strokeOpacity: 0.55, strokeWeight: 2,
          clickable: false,
        }),
      );
    });

    return () => { circlesRef.current.forEach((c) => c.setMap(null)); circlesRef.current = []; };
  }, [map, hotspots]);

  return null;
}

/* ─── Fit to Guam on load + resize ─── */
const GUAM_LATLNG_BOUNDS = {
  south: GUAM_BOUNDS[0][1], west: GUAM_BOUNDS[0][0],
  north: GUAM_BOUNDS[1][1], east: GUAM_BOUNDS[1][0],
};

function FitBoundsOnLoad() {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map) return;

    const fit = () => {
      // fitBounds chooses the largest zoom where the bounds fit entirely.
      // Because Guam is tall & narrow, wide screens leave a lot of ocean.
      // Nudge +0.6 zoom so the island fills the viewport more snugly,
      // but clamp between 10–12 so it's never too tight or too loose.
      map.fitBounds(GUAM_LATLNG_BOUNDS, GUAM_BOUNDS_PADDING);

      // fitBounds is sync — zoom is set immediately after the call.
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

/* ─── Polygon centroid (shoelace formula — true geometric center) ─── */
function polygonCentroid(ring: [number, number][]): { lat: number; lng: number } {
  let area = 0, cx = 0, cy = 0;
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

/* ─── Zoom that fits a polygon into the map viewport ─── */
function zoomForBounds(map: google.maps.Map, ring: [number, number][], padding = 60): number {
  const div = map.getDiv();
  const w = div.offsetWidth - padding * 2;
  const h = div.offsetHeight - padding * 2;
  if (w <= 0 || h <= 0) return 13;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
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

  // floor so we show a little context around the village rather than clipping edges
  return Math.floor(Math.min(zLng, zLat));
}

/* ─── Smooth fly-to via requestAnimationFrame ─── */
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

  // Scale duration to distance so nearby hops don't drag and long jumps don't rush.
  const dLat = Math.abs(target.lat - sLat);
  const dLng = Math.abs(target.lng - sLng);
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const durationMs = Math.min(1200, Math.max(700, dist * 1800));

  const start = performance.now();

  (function frame(now: number) {
    if (id !== _flyId) return;
    const t = Math.min(1, (now - start) / durationMs);

    // Ease-in-out quad — gentle start AND gentle landing
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

/* ─── Fly to village when selected, or back to island when deselected ─── */
function FitVillageBounds({ villages, selectedVillageId }: { villages: Village[]; selectedVillageId: string | null }) {
  const map = useMap();
  const hasInteracted = useRef(false);

  // useLayoutEffect fires synchronously after DOM mutation but before browser paint,
  // so the animation starts before any child component paint work.
  useLayoutEffect(() => {
    if (!map) return;

    if (!selectedVillageId) {
      if (!hasInteracted.current) return;
      const [[w, s], [e, n]] = GUAM_BOUNDS;
      const islandRing: [number, number][] = [[w, s], [e, s], [e, n], [w, n]];
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

/* ─── Map controls ─── */
function MapControls({ showVillages, onToggleVillages }: { showVillages: boolean; onToggleVillages: () => void }) {
  const map = useMap();

  return (
    <div className={styles.mapControls}>
      <button className={styles.mapCtrlBtn} title="Zoom in" onClick={() => map?.setZoom((map.getZoom() ?? 10) + 1)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button className={styles.mapCtrlBtn} title="Zoom out" onClick={() => map?.setZoom((map.getZoom() ?? 10) - 1)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button className={styles.mapCtrlBtn} title="Reset north" onClick={() => map?.setHeading(0)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(69,217,168,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 20,22 12,17 4,22" />
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
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(69,217,168,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
          <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
    </div>
  );
}

/* ─── OverlayView-based popup (positions synchronously with map render) ─── */
// Lazy-init: google.maps doesn't exist at module parse time (loaded by APIProvider).
let _OverlayClass: (new (pos: google.maps.LatLng, map: google.maps.Map) => google.maps.OverlayView & { container: HTMLDivElement; updatePosition(p: google.maps.LatLng): void }) | null = null;

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
      case "VILLAGE": return new google.maps.LatLng(info.lat, info.lng);
      case "PLACE": return new google.maps.LatLng(info.place.lat, info.place.lng);
      case "EVENT": return new google.maps.LatLng(info.event.lat, info.event.lng);
      case "USER": return new google.maps.LatLng(info.lat, info.lng);
      case "LIVE": return new google.maps.LatLng(info.hotspot.lat, info.hotspot.lng);
    }
  }, [info]);

  // Create / destroy the overlay
  useEffect(() => {
    if (!map) return;
    const Cls = getOverlayClass();
    const ov = new Cls(latLng, map);
    overlayRef.current = ov;
    setContainer(ov.container);
    return () => { ov.setMap(null); overlayRef.current = null; setContainer(null); };
  }, [map]); // only recreate when map changes

  // Update position when info changes
  useEffect(() => {
    overlayRef.current?.updatePosition(latLng);
  }, [latLng]);

  const content = useMemo(() => {
    switch (info.kind) {
      case "VILLAGE":
        return (<><div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.village.name}</div><div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>Tap to explore</div></>);
      case "PLACE":
        return (<><div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.place.name}</div><div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{info.place.type} &middot; {info.place.source}</div></>);
      case "EVENT":
        return (<><div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>{info.event.title}</div><div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{info.event.when ?? ""} &middot; {info.event.source}</div></>);
      case "USER":
        return (<><div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>You are here</div><div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{info.lat.toFixed(5)}, {info.lng.toFixed(5)}{typeof info.acc === "number" ? ` · ±${Math.round(info.acc)}m` : ""}</div></>);
      case "LIVE":
        return (<><div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e8" }}>Live activity</div><div style={{ color: "#c4c4c4", fontSize: 12, marginTop: 2 }}>{info.hotspot.label}</div><div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{info.hotspot.count} recent check-ins (demo)</div></>);
    }
  }, [info]);

  if (!container) return null;

  return createPortal(
    <>
      {/* Arrow */}
      <div style={{
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
      }} />
      {/* Bubble */}
      <div style={{
        position: "relative",
        background: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "10px 32px 10px 12px",
        fontFamily: "var(--sans)",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
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
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e8e8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#8a8a8a")}
        >
          &times;
        </button>
        {content}
      </div>
    </>,
    container,
  );
}

/* ═══════════════════════════════════════════════════════════
   HomePage
   ═══════════════════════════════════════════════════════════ */
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

  // Deferred village ID — lets the animation start before React re-renders
  // the sidebar (filtered results, markers, etc.). The map camera effect
  // reads selectedVillageId immediately, but heavy sidebar computations
  // run off deferredVillageId which updates one frame later.
  const [deferredVillageId, setDeferredVillageId] = useState<string | null>(null);
  const deferTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { userLoc, userAcc, locateMe } = useUserLocation(villages, (id) => {
    setSelectedVillageId(id);
    setSelected(null);
  });

  const { filteredPlaces, filteredEvents, results } = useFilteredResults(PLACES, EVENTS, {
    selectedVillageId: deferredVillageId, category, search, openNow, nearMe, userLoc,
  });

  const selectedVillageName = useMemo(() => {
    if (!deferredVillageId) return "All Guam";
    return villages.find((v) => v.id === deferredVillageId)?.name ?? "All Guam";
  }, [deferredVillageId, villages]);

  const villagePlaces = useMemo(() => {
    if (!deferredVillageId) return [];
    return PLACES.filter((p) => p.villageId === deferredVillageId);
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

  // Single handler for both map click and dropdown — clears popup so
  // InfoWindow auto-pan can't fight the panTo transition.
  const selectVillage = useCallback((id: string | null) => {
    setSelectedVillageId(id);
    setSelected(null);
    setPopupInfo(null);
    // Defer the sidebar update so the animation frame isn't blocked
    clearTimeout(deferTimeoutRef.current);
    deferTimeoutRef.current = setTimeout(() => setDeferredVillageId(id), 60);
  }, []);

  const onVillageClick = useCallback(
    (villageId: string, _lat: number, _lng: number) => {
      selectVillage(villageId);
      const v = villages.find((x) => x.id === villageId);
      if (!v) return;
      // Position popup at the village centroid, not the cursor click point
      const center = polygonCentroid(v.polygon);
      setPopupInfo({
        kind: "VILLAGE",
        village: v,
        lng: center.lng, lat: center.lat,
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

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        {/* MAP */}
        <div className={styles.mapWrap}>
          <div className={styles.mapHud}>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showPOI ? styles.pillActive : ""}`}
              onClick={() => setShowPOI((s) => !s)}
            >POIs</button>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showEvents ? styles.pillActive : ""}`}
              onClick={() => setShowEvents((s) => !s)}
            >Events</button>
            <button
              className={`${styles.pill} ${styles.hudPill} ${showLive ? styles.pillActive : ""}`}
              onClick={() => setShowLive((s) => !s)}
            >Live</button>
            <button className={`${styles.pill} ${styles.hudPill}`} onClick={locateMe}>
              Use my location
            </button>
          </div>

          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <GoogleMap
              defaultCenter={{ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }}
              defaultZoom={10}
              gestureHandling="greedy"
              disableDefaultUI={true}
              backgroundColor="#212121"
              style={{ width: "100%", height: "100%" }}
              styles={DARK_STYLE}
            >
              <FitBoundsOnLoad />
              <FitVillageBounds villages={villages} selectedVillageId={selectedVillageId} />
              <MapControls
                showVillages={showVillages}
                onToggleVillages={toggleShowVillages}
              />

              <VillageOverlay
                villages={villages}
                selectedVillageId={selectedVillageId}
                showVillages={showVillages}
                onVillageClick={onVillageClick}
              />

              {/* User location */}
              {userLoc && userAcc != null && (
                <UserLocationCircle lat={userLoc.lat} lng={userLoc.lng} accuracy={userAcc} />
              )}
              {userLoc && (
                <Marker
                  position={{ lat: userLoc.lat, lng: userLoc.lng }}
                  icon={markerIcon(dotIcon("#45d9a8", 14, "white"), 14)}
                  onClick={() => setPopupInfo({ kind: "USER", lng: userLoc.lng, lat: userLoc.lat, acc: userAcc })}
                />
              )}

              {/* POI markers */}
              {showPOI && filteredPlaces.map((p) => (
                <Marker
                  key={p.id}
                  position={{ lat: p.lat, lng: p.lng }}
                  icon={markerIcon(emojiIcon(placeEmoji(p.type), "rgba(255,255,255,0.18)", "rgba(20,20,20,0.85)"), 30)}
                  onClick={() => { setSelected({ kind: "PLACE", id: p.id }); setPopupInfo({ kind: "PLACE", place: p }); }}
                />
              ))}

              {/* Event markers */}
              {showEvents && filteredEvents.map((ev) => (
                <Marker
                  key={ev.id}
                  position={{ lat: ev.lat, lng: ev.lng }}
                  icon={markerIcon(emojiIcon(eventEmoji(ev.status), ev.status === "VERIFIED" ? "rgba(69,217,168,0.45)" : "rgba(245,158,11,0.45)", ev.status === "VERIFIED" ? "rgba(69,217,168,0.12)" : "rgba(245,158,11,0.12)"), 30)}
                  onClick={() => { setSelected({ kind: "EVENT", id: ev.id }); setPopupInfo({ kind: "EVENT", event: ev }); }}
                />
              ))}

              {/* Live hotspot zones + markers */}
              {showLive && <LiveCircles hotspots={LIVE} />}
              {showLive && LIVE.map((x) => (
                <Marker
                  key={x.id}
                  position={{ lat: x.lat, lng: x.lng }}
                  icon={markerIcon(dotIcon("rgba(245,158,11,0.8)", 10, "rgba(245,158,11,1)"), 10)}
                  onClick={() => setPopupInfo({ kind: "LIVE", hotspot: x })}
                />
              ))}

              {popupInfo && <MapPopup info={popupInfo} onClose={() => setPopupInfo(null)} />}
            </GoogleMap>
          </APIProvider>
        </div>

        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.brand}>
              GuamRadar <span className={styles.badgeWip}>WIP</span>
            </div>
            <button
              className={`${styles.pill} ${musicOn ? styles.pillActive : ""}`}
              onClick={toggleMusic}
              title="Toggle background music"
            >
              {musicOn ? "🔊 Music: ON" : "🔇 Music: OFF"}
            </button>
          </div>

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
                  <button className={styles.btn} onClick={reset}>Reset</button>
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

              <ResultsList
                results={results}
                userLoc={userLoc}
                onSelect={onSelectResult}
              />
            </div>
          </div>

          <DetailsPanel
            selectedDetail={selectedDetail}
            isOpen={detailsOpen}
            onToggle={toggleDetails}
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
