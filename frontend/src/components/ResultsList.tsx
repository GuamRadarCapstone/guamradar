import { memo } from "react";
import type { ResultItem } from "../hooks/useFilteredResults";
import { haversineKm } from "../lib/math";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, categoryLabel, t } from "../lib/i18n";
import {
  getCategoryBg,
  getCategoryColor,
  getCategoryIcon,
  getPoiOpenText,
} from "../pages/HomePage/demoData";

type UserLoc = { lat: number; lng: number } | null;

export const ResultsList = memo(function ResultsList({
  lang,
  results,
  userLoc,
  onSelect,
}: {
  lang: Language;
  results: ResultItem[];
  userLoc: UserLoc;
  onSelect: (kind: "PLACE" | "EVENT", id: string) => void;
}) {
  return (
    <div className={styles.list}>
      {results.length === 0 ? (
        <div className={styles.empty}>{t(lang, "noResults")}</div>
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
          const label = categoryLabel(rawCategory, lang);

          const meta = isPlace
            ? `${r.data.source ?? t(lang, "demoData")}`
            : `${r.data.status === "VERIFIED" ? t(lang, "eventVerified") : t(lang, "eventPending")} • ${r.data.source ?? t(lang, "demoData")}`;

          let openText = t(lang, "hoursUnavailable");
          if (isPlace) {
            try {
              openText = getPoiOpenText(r.data as any);
              if (openText === "Open now") openText = t(lang, "openNow");
              else if (openText === "Closed now") openText = t(lang, "closedNow");
              else if (openText === "Hours unavailable") openText = t(lang, "hoursUnavailable");
            } catch {
              openText = (r.data as any).hours ?? t(lang, "hoursUnavailable");
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
                  {isPlace ? label : categoryLabel((r.data as any).status ?? "EVENT", lang)}
                </div>
              </div>

              <div className={styles.itemDesc}>{meta}</div>

              <div className={styles.itemMeta}>
                {dist != null && <span>📍 {dist.toFixed(1)} km</span>}

                {isPlace ? (
                  <span
                    style={{
                      color:
                        openText === "Open now" || openText === t(lang, "openNow")
                          ? "#22c55e"
                          : openText === "Closed now" || openText === t(lang, "closedNow")
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

                {isPlace && (r.data as any).verified && <span>✅ {t(lang, "verified")}</span>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
});