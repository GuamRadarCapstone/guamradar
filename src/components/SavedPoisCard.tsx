import { useMemo, useState } from "react";
import type { Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, categoryLabel, t } from "../lib/i18n";

export function SavedPoisCard({
  lang,
  savedPoiIds,
  allPlaces,
  onSelectPlace,
  onRemoveSaved,
}: {
  lang: Language;
  savedPoiIds: string[];
  allPlaces: Place[];
  onSelectPlace: (id: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const savedPlaces = useMemo(() => {
    const set = new Set(savedPoiIds);
    return allPlaces.filter((p) => set.has(p.id));
  }, [savedPoiIds, allPlaces]);

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "2px 0" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={styles.bigTextSmall}>{t(lang, "savedPlaces")}</span>
          <span className={styles.badge}>{savedPlaces.length}</span>
        </div>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {savedPlaces.length === 0 ? (
            <div className={styles.muted}>{t(lang, "noSavedPlaces")}</div>
          ) : (
            savedPlaces.map((place) => (
              <div
                key={place.id}
                className={styles.rowBetween}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  gap: 8,
                }}
              >
                <div
                  style={{ cursor: "pointer", minWidth: 0 }}
                  onClick={() => onSelectPlace(place.id)}
                >
                  <div style={{ fontWeight: 600 }}>{place.name}</div>
                  <div className={styles.muted} style={{ fontSize: 12 }}>{categoryLabel(place.type, lang)}</div>
                </div>

                <button className={styles.btn} onClick={() => onRemoveSaved(place.id)} style={{ flexShrink: 0 }}>
                  {t(lang, "remove")}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
