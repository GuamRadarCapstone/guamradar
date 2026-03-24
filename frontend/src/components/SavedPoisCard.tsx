import { useMemo } from "react";
import type { Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";

export function SavedPoisCard({
  savedPoiIds,
  allPlaces,
  onSelectPlace,
  onRemoveSaved,
}: {
  savedPoiIds: string[];
  allPlaces: Place[];
  onSelectPlace: (id: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const savedPlaces = useMemo(() => {
    const set = new Set(savedPoiIds);
    return allPlaces.filter((p) => set.has(p.id));
  }, [savedPoiIds, allPlaces]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.bigTextSmall}>Saved POIs</div>
        <div className={styles.badge}>{savedPlaces.length}</div>
      </div>

      <div className={styles.cardBody}>
        {savedPlaces.length === 0 ? (
          <div className={styles.muted}>No saved POIs yet.</div>
        ) : (
          savedPlaces.map((place) => (
            <div
              key={place.id}
              className={styles.rowBetween}
              style={{
                padding: "8px 0",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                gap: 8,
              }}
            >
              <div
                style={{ cursor: "pointer", minWidth: 0 }}
                onClick={() => onSelectPlace(place.id)}
              >
                <div>{place.name}</div>
                <div className={styles.muted}>{place.type}</div>
              </div>

              <button className={styles.btn} onClick={() => onRemoveSaved(place.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}