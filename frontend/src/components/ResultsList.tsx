import { memo } from "react";
import type { ResultItem } from "../hooks/useFilteredResults";
import { haversineKm } from "../lib/math";
import styles from "../pages/HomePage/HomePage.module.css";
import {
  getCategoryBg,
  getCategoryColor,
  getCategoryIcon,
  getCategoryLabel,
  getPoiOpenText,
} from "../pages/HomePage/demoData";

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
          const isPlace = r.kind === "PLACE";
          const title = isPlace ? r.data.name : r.data.title;

          const dist = userLoc
            ? haversineKm(userLoc.lat, userLoc.lng, r.data.lat, r.data.lng)
            : null;

          const rawCategory = isPlace ? r.data.type ?? "ATTRACTION" : "EVENT";

          const icon = getCategoryIcon(rawCategory as any);
          const color = getCategoryColor(rawCategory as any);
          const bg = getCategoryBg(rawCategory as any);
          const label = getCategoryLabel(rawCategory as any);

          const meta = isPlace
            ? `${r.data.source ?? "Demo Data"}`
            : `${r.data.status === "VERIFIED" ? "Event (Verified)" : "Event (Pending)"} • ${r.data.source ?? "Demo Data"}`;

          let openText = "Hours unavailable";
          if (isPlace) {
            try {
              openText = getPoiOpenText(r.data as any);            } catch {
              openText = (r.data as any).hours ?? "Hours unavailable";
            }
          }

          return (
            <button
              key={`${r.kind}:${r.data.id}`}
              className={styles.item}
              onClick={() => onSelect(r.kind, r.data.id)}
              style={{ border: `1px solid ${color}` }}
            >
              <div className={styles.itemTop}>
                <div className={styles.itemTitle}>
                  <span style={{ marginRight: 8 }}>{icon}</span>
                  {title}
                </div>

                <div
                  className={styles.badge}
                  style={{
                    background: bg,
                    color,
                    border: `1px solid ${color}`,
                  }}
                >
                  {isPlace ? label : ((r.data as any).status ?? "EVENT")}
                </div>
              </div>

              <div className={styles.itemDesc}>{meta}</div>

              <div className={styles.itemMeta}>
                {dist != null && <span>📍 {dist.toFixed(1)} km</span>}

                {isPlace ? (
                  <span
                    style={{
                      color:
                        openText === "Open now"
                          ? "#22c55e"
                          : openText === "Closed now"
                            ? "#ef4444"
                            : undefined,
                      fontWeight: 700,
                    }}
                  >
                    ⏰ {openText}
                  </span>
                ) : (
                  <span>🗓️ {(r.data as any).when ?? ""}</span>
                )}

                {isPlace && (r.data as any).verified && <span>✅ Verified</span>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
});