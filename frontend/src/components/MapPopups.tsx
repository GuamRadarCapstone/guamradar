import { Popup } from "react-map-gl/mapbox";
import type { Village, Place, EventItem, LiveHotspot } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";

export type PopupInfo =
  | { kind: "VILLAGE"; village: Village; lng: number; lat: number }
  | { kind: "PLACE"; place: Place }
  | { kind: "EVENT"; event: EventItem }
  | { kind: "USER"; lng: number; lat: number; acc: number | null }
  | { kind: "LIVE"; hotspot: LiveHotspot }
  | null;

export function MapPopups({
  popupInfo,
  onClose,
}: {
  popupInfo: PopupInfo;
  onClose: () => void;
}) {
  if (!popupInfo) return null;

  if (popupInfo.kind === "VILLAGE") {
    return (
      <Popup longitude={popupInfo.lng} latitude={popupInfo.lat} anchor="bottom" onClose={onClose}>
        <b>{popupInfo.village.name}</b>
        <div className={styles.muted}>Tap to explore</div>
      </Popup>
    );
  }

  if (popupInfo.kind === "PLACE") {
    return (
      <Popup longitude={popupInfo.place.lng} latitude={popupInfo.place.lat} anchor="bottom" onClose={onClose}>
        <b>{popupInfo.place.name}</b>
        <div className={styles.muted}>{popupInfo.place.type} • {popupInfo.place.source}</div>
      </Popup>
    );
  }

  if (popupInfo.kind === "EVENT") {
    return (
      <Popup longitude={popupInfo.event.lng} latitude={popupInfo.event.lat} anchor="bottom" onClose={onClose}>
        <b>{popupInfo.event.title}</b>
        <div className={styles.muted}>{popupInfo.event.when ?? ""} • {popupInfo.event.source}</div>
      </Popup>
    );
  }

  if (popupInfo.kind === "USER") {
    return (
      <Popup longitude={popupInfo.lng} latitude={popupInfo.lat} anchor="bottom" onClose={onClose}>
        <b>You are here</b>
        <div className={styles.muted}>
          {popupInfo.lat.toFixed(5)}, {popupInfo.lng.toFixed(5)}
          {typeof popupInfo.acc === "number" ? ` • ±${Math.round(popupInfo.acc)}m` : ""}
        </div>
      </Popup>
    );
  }

  if (popupInfo.kind === "LIVE") {
    return (
      <Popup longitude={popupInfo.hotspot.lng} latitude={popupInfo.hotspot.lat} anchor="bottom" onClose={onClose}>
        <b>Live activity</b>
        <div>{popupInfo.hotspot.label}</div>
        <div className={styles.muted}>{popupInfo.hotspot.count} recent check-ins (demo)</div>
      </Popup>
    );
  }

  return null;
}
