import { memo } from "react";
import type { ResultItem } from "../hooks/useFilteredResults";
import { haversineKm } from "../lib/math";
import styles from "../pages/HomePage/HomePage.module.css";

type UserLoc = { lat: number; lng: number } | null;

export const ResultsList = memo(function ResultsList({
  results,
  userLoc,
  onSelect,
}: {
  results: ResultItem[];
  userLoc: UserLoc;
  onSelect: (kind: "PLACE" | "EVENT", id: string) => void;
}) {
  return (
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

          const dist = userLoc
            ? haversineKm(userLoc.lat, userLoc.lng, r.data.lat, r.data.lng)
            : null;

          return (
            <button
              key={`${r.kind}:${r.data.id}`}
              className={styles.item}
              onClick={() => onSelect(r.kind, r.data.id)}
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
                {r.kind === "PLACE"
                  ? <span>⏰ {r.data.hours}</span>
                  : <span>🗓️ {r.data.when ?? ""}</span>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
});
