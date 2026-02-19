import type { MapRef } from "react-map-gl/mapbox";
import type { RefObject } from "react";
import styles from "../pages/HomePage/HomePage.module.css";

const GUAM_BOUNDS: [[number, number], [number, number]] = [
  [144.62, 13.23],
  [144.96, 13.65],
];
const GUAM_BOUNDS_PADDING = 20;

export function MapControls({
  mapRef,
  showVillages,
  onToggleVillages,
}: {
  mapRef: RefObject<MapRef | null>;
  showVillages: boolean;
  onToggleVillages: () => void;
}) {
  return (
    <div className={styles.mapControls}>
      <button
        className={styles.mapCtrlBtn}
        title="Zoom in"
        onClick={() => mapRef.current?.getMap().zoomIn()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        className={styles.mapCtrlBtn}
        title="Zoom out"
        onClick={() => mapRef.current?.getMap().zoomOut()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        className={styles.mapCtrlBtn}
        title="Reset north"
        onClick={() => mapRef.current?.getMap().resetNorth()}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(69,217,168,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 20,22 12,17 4,22" />
        </svg>
      </button>
      <button
        className={styles.mapCtrlBtn}
        title="Center on Guam"
        onClick={() => {
          const map = mapRef.current?.getMap();
          if (map) {
            map.setPitch(0);
            map.setBearing(0);
            map.fitBounds(GUAM_BOUNDS, { padding: GUAM_BOUNDS_PADDING, duration: 1000 });
          }
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
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
    </div>
  );
}
