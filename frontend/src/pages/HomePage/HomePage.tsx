import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";

import styles from "./HomePage.module.css";
import { EVENTS, LIVE, PLACES } from "./demoData";

import { useVillages } from "../../hooks/useVillages";
import { useUserLocation } from "../../hooks/useUserLocation";
import { useFilteredResults } from "../../hooks/useFilteredResults";
import { useMusic } from "../../hooks/useMusic";

import { EmojiPin } from "../../components/EmojiPin";
import { MapControls } from "../../components/MapControls";
import { MapPopups, type PopupInfo } from "../../components/MapPopups";
import { ResultsList } from "../../components/ResultsList";
import { DetailsPanel } from "../../components/DetailsPanel";
import { VillageBrowser } from "../../components/VillageBrowser";

import { ringBBoxExport as ringBBox } from "../../lib/geo";
import { DEFAULT_CENTER, GUAM_BOUNDS, GUAM_BOUNDS_PADDING } from "../../lib/constants";
import { circlePolygon } from "../../lib/math";
import { placeEmoji, eventEmoji } from "../../lib/ui";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;


type Category = "ALL" | "ATTRACTION" | "RESTAURANT" | "HOTEL";
type Selected = { kind: "PLACE"; id: string } | { kind: "EVENT"; id: string } | null;

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
  const [mapReady, setMapReady] = useState(false);

  const [selected, setSelected] = useState<Selected>(null);
  const [popupInfo, setPopupInfo] = useState<PopupInfo>(null);
  const [cursor, setCursor] = useState<string>("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [villageOpen, setVillageOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const mapRef = useRef<MapRef>(null);
  const roadLabelsShown = useRef(false);

  const { userLoc, userAcc, locateMe } = useUserLocation(villages, (id) => {
    setSelectedVillageId(id);
    setSelected(null);
  });

  const { filteredPlaces, filteredEvents, results } = useFilteredResults(PLACES, EVENTS, {
    selectedVillageId,
    category,
    search,
    openNow,
    nearMe,
    userLoc,
  });

  /* ---- Fit bounds when village selected ---- */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (!selectedVillageId) return;

    const v = villages.find((x) => x.id === selectedVillageId);
    if (!v) return;
    const bb = ringBBox(v.polygon);
    mapRef.current!.fitBounds(
      [[bb.minLng, bb.minLat], [bb.maxLng, bb.maxLat]],
      { padding: 30, maxZoom: 13, duration: 500, linear: true },
    );
  }, [selectedVillageId, villages]);


  /* ---- Fly to selected place/event ---- */
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
    mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 13) });
  }, [focus]);

  /* ---- Derived values ---- */
  const selectedVillageName = useMemo(() => {
    if (!selectedVillageId) return "All Guam";
    return villages.find((v) => v.id === selectedVillageId)?.name ?? "All Guam";
  }, [selectedVillageId, villages]);

  const villagePlaces = useMemo(() => {
    if (!selectedVillageId) return [];
    return PLACES.filter((p) => p.villageId === selectedVillageId);
  }, [selectedVillageId]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "PLACE") {
      const p = PLACES.find((x) => x.id === selected.id);
      return p ? { kind: "PLACE" as const, p } : null;
    }
    const e = EVENTS.find((x) => x.id === selected.id);
    return e ? { kind: "EVENT" as const, e } : null;
  }, [selected]);

  /* ---- GeoJSON memos for map layers ---- */
  const villageGeoJson = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: villages.map((v) => ({
      type: "Feature",
      properties: { id: v.id, name: v.name, selected: v.id === selectedVillageId ? 1 : 0 },
      geometry: { type: "Polygon", coordinates: [v.polygon] },
    })),
  }), [villages, selectedVillageId]);

  const villageLabelGeoJson = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: villages.map((v) => {
      let sumLng = 0, sumLat = 0;
      const n = v.polygon.length;
      for (const [lng, lat] of v.polygon) { sumLng += lng; sumLat += lat; }
      return {
        type: "Feature" as const,
        properties: { id: v.id, name: v.name, selected: v.id === selectedVillageId ? 1 : 0 },
        geometry: { type: "Point" as const, coordinates: [sumLng / n, sumLat / n] },
      };
    }),
  }), [villages, selectedVillageId]);

  const userLocGeoJson = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!userLoc) return null;
    const radius = userAcc ? Math.max(80, Math.min(userAcc, 600)) : 80;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [circlePolygon(userLoc.lng, userLoc.lat, radius)] },
      }],
    };
  }, [userLoc, userAcc]);

  const liveGeoJson = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: LIVE.map((x) => ({
      type: "Feature",
      properties: { id: x.id, label: x.label, count: x.count },
      geometry: {
        type: "Polygon",
        coordinates: [circlePolygon(x.lng, x.lat, Math.max(300, Math.min(2000, x.count * 35)))],
      },
    })),
  }), []);

  /* ---- Imperative village layers ---- */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady) return;

    const SRC = "villages";
    const SRC_LABELS = "village-labels";

    const existingSrc = map.getSource(SRC) as any;
    if (existingSrc) {
      existingSrc.setData(villageGeoJson);
    } else {
      map.addSource(SRC, { type: "geojson", data: villageGeoJson });
      // Invisible fill to keep villages clickable
      map.addLayer({
        id: "village-fill", type: "fill", source: SRC,
        paint: {
          "fill-color": "rgba(52,211,153,0.25)",
          "fill-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0],
          "fill-emissive-strength": 1,
        },
      } as any);
      // Hairline white border on all villages — very subtle grid so users know they're clickable
      map.addLayer({
        id: "village-grid", type: "line", source: SRC,
        paint: {
          "line-color": "rgba(0,0,0,0.35)",
          "line-width": 1.25,
          "line-emissive-strength": 1,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      } as any);
      // Selected village: soft teal glowing border on top
      map.addLayer({
        id: "village-outline", type: "line", source: SRC,
        paint: {
          "line-color": "rgba(52,211,153,1)",
          "line-width": 2.5,
          "line-blur": 1,
          "line-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0],
          "line-emissive-strength": 1,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      } as any);
    }

    const existingLabelSrc = map.getSource(SRC_LABELS) as any;
    if (existingLabelSrc) {
      existingLabelSrc.setData(villageLabelGeoJson);
    } else {
      map.addSource(SRC_LABELS, { type: "geojson", data: villageLabelGeoJson });
      map.addLayer({
        id: "village-label", type: "symbol", source: SRC_LABELS,
        layout: {
          "text-field": ["case", ["==", ["get", "selected"], 1], ["get", "name"], ""],
          "text-size": 15,
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-letter-spacing": 0.05,
        },
        paint: {
          "text-color": "rgba(16,185,129,1)",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2.5,
        },
      } as any);
    }

    const vis = showVillages ? "visible" : "none";
    if (map.getLayer("village-fill")) map.setLayoutProperty("village-fill", "visibility", vis);
    if (map.getLayer("village-grid")) map.setLayoutProperty("village-grid", "visibility", vis);
    if (map.getLayer("village-outline")) map.setLayoutProperty("village-outline", "visibility", vis);
    if (map.getLayer("village-label")) map.setLayoutProperty("village-label", "visibility", vis);

  }, [mapReady, villageGeoJson, villageLabelGeoJson, showVillages]);

  /* ---- Map event handlers ---- */
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

  function reset() {
    setSelectedVillageId(null);
    setCategory("ALL");
    setSearch("");
    setOpenNow(false);
    setNearMe(false);
    setSelected(null);
    setPopupInfo(null);
  }

  return (
    <div className={styles.page}>
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

          <div className={styles.map} style={{ width: "100%", height: "100%" }}>
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: DEFAULT_CENTER.lng,
                latitude: DEFAULT_CENTER.lat,
                zoom: 10,
                pitch: 0,
                bearing: 0,
              }}
              mapStyle="mapbox://styles/mapbox/standard"
              style={{
                width: "100%",
                height: "100%",
                background: "#e8e0d8",
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
                map.setConfigProperty("basemap", "lightPreset", "day");
                map.setConfigProperty("basemap", "showRoadLabels", false);
                map.setConfigProperty("basemap", "showTransitLabels", false);
                // Road labels: show when zoomed in OR when a village is selected (prevents
                // labels flickering off during village-to-village transitions)
                map.on("zoom", () => {
                  const show = map.getZoom() >= 13;
                  if (show !== roadLabelsShown.current) {
                    roadLabelsShown.current = show;
                    (map as any).setConfigProperty("basemap", "showRoadLabels", show);
                  }
                });
                // Mariana Islands: hide once tiles are loaded, skip if map is moving
                const hideMarianaIslands = () => {
                  if (map.isMoving() || map.isZooming() || map.isRotating()) return;
                  const canvas = map.getCanvas();
                  const all = map.queryRenderedFeatures([[0, 0], [canvas.width, canvas.height]]);
                  all.forEach((f: any) => {
                    if (f.properties?.name === "Mariana Islands" || f.properties?.name === "Northern Mariana Islands") {
                      map.setFeatureState(f, { hide: true });
                    }
                  });
                };
                map.on("idle", hideMarianaIslands);

                map.fitBounds(GUAM_BOUNDS, { padding: GUAM_BOUNDS_PADDING, duration: 0 });
                map.once("idle", () => setMapReady(true));
              }}
            >
              <MapControls
                mapRef={mapRef}
                showVillages={showVillages}
                onToggleVillages={() => setShowVillages((v) => !v)}
              />

              {/* User location circle */}
              {mapReady && userLocGeoJson && (
                <Source id="user-loc" type="geojson" data={userLocGeoJson}>
                  <Layer
                    id="user-loc-fill"
                    type="fill"
                    paint={{ "fill-color": "rgba(69,217,168,0.25)", "fill-opacity": 1, "fill-emissive-strength": 1 } as any}
                  />
                  <Layer
                    id="user-loc-outline"
                    type="line"
                    paint={{ "line-color": "rgba(69,217,168,0.9)", "line-width": 2, "line-emissive-strength": 1 } as any}
                  />
                </Source>
              )}

              {/* User dot marker */}
              {userLoc && (
                <Marker longitude={userLoc.lng} latitude={userLoc.lat} anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPopupInfo({ kind: "USER", lng: userLoc.lng, lat: userLoc.lat, acc: userAcc });
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#45d9a8", border: "2px solid white", boxShadow: "0 0 6px rgba(69,217,168,0.6)" }} />
                </Marker>
              )}

              {/* POI markers */}
              {showPOI && filteredPlaces.map((p) => (
                <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelected({ kind: "PLACE", id: p.id });
                    setPopupInfo({ kind: "PLACE", place: p });
                  }}
                >
                  <EmojiPin emoji={placeEmoji(p.type)} border="rgba(255,255,255,0.18)" bg="rgba(20,20,20,0.85)" />
                </Marker>
              ))}

              {/* Event markers */}
              {showEvents && filteredEvents.map((ev) => (
                <Marker key={ev.id} longitude={ev.lng} latitude={ev.lat} anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelected({ kind: "EVENT", id: ev.id });
                    setPopupInfo({ kind: "EVENT", event: ev });
                  }}
                >
                  <EmojiPin
                    emoji={eventEmoji(ev.status)}
                    border={ev.status === "VERIFIED" ? "rgba(69,217,168,0.45)" : "rgba(245,158,11,0.45)"}
                    bg={ev.status === "VERIFIED" ? "rgba(69,217,168,0.12)" : "rgba(245,158,11,0.12)"}
                  />
                </Marker>
              ))}

              {/* Live hotspot zones */}
              {mapReady && showLive && (
                <Source id="live-zones" type="geojson" data={liveGeoJson}>
                  <Layer id="live-fill" type="fill" paint={{ "fill-color": "rgba(245,158,11,0.18)", "fill-opacity": 0.9, "fill-emissive-strength": 1 } as any} />
                  <Layer id="live-outline" type="line" paint={{ "line-color": "rgba(245,158,11,0.55)", "line-width": 2, "line-emissive-strength": 1 } as any} />
                </Source>
              )}

              {/* Live hotspot markers */}
              {showLive && LIVE.map((x) => (
                <Marker key={x.id} longitude={x.lng} latitude={x.lat} anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPopupInfo({ kind: "LIVE", hotspot: x });
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(245,158,11,0.8)", border: "1px solid rgba(245,158,11,1)" }} />
                </Marker>
              ))}

              <MapPopups popupInfo={popupInfo} onClose={() => setPopupInfo(null)} />
            </Map>
          </div>
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
                onSelect={(kind, id) => setSelected({ kind, id })}
              />
            </div>
          </div>

          <DetailsPanel
            selectedDetail={selectedDetail}
            isOpen={detailsOpen}
            onToggle={() => setDetailsOpen((o) => !o)}
          />

          <VillageBrowser
            villages={villages}
            selectedVillageId={selectedVillageId}
            villagePlaces={villagePlaces}
            isOpen={villageOpen}
            dropdownOpen={dropdownOpen}
            onToggle={() => setVillageOpen((o) => !o)}
            onSelectVillage={(id) => { setSelectedVillageId(id); setSelected(null); }}
            onSelectPlace={(id) => setSelected({ kind: "PLACE", id })}
            onDropdownToggle={() => setDropdownOpen((o) => !o)}
            onResetToAll={() => {
              setSelectedVillageId(null);
              const map = mapRef.current?.getMap();
              if (map) {
                map.setPitch(0);
                map.setBearing(0);
                map.fitBounds(GUAM_BOUNDS, { padding: GUAM_BOUNDS_PADDING, duration: 1000 });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
