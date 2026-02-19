import { useRef, useEffect } from "react";
import type { Village, Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";

export function VillageBrowser({
  villages,
  selectedVillageId,
  villagePlaces,
  isOpen,
  dropdownOpen,
  onToggle,
  onSelectVillage,
  onSelectPlace,
  onDropdownToggle,
  onResetToAll,
}: {
  villages: Village[];
  selectedVillageId: string | null;
  villagePlaces: Place[];
  isOpen: boolean;
  dropdownOpen: boolean;
  onToggle: () => void;
  onSelectVillage: (id: string) => void;
  onSelectPlace: (id: string) => void;
  onDropdownToggle: () => void;
  onResetToAll: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (dropdownOpen) onDropdownToggle();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen, onDropdownToggle]);

  const restaurants = villagePlaces.filter((p) => p.type === "RESTAURANT");
  const attractions = villagePlaces.filter((p) => p.type === "ATTRACTION");
  const hotels = villagePlaces.filter((p) => p.type === "HOTEL");

  const selectedName = selectedVillageId
    ? villages.find((v) => v.id === selectedVillageId)?.name ?? "Select village"
    : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <div className={styles.bigTextSmall}>Browse by Village</div>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div className={styles.cardBody}>
          <div className={styles.dropdown} ref={dropdownRef}>
            <button
              className={styles.dropdownTrigger}
              onClick={(e) => { e.stopPropagation(); onDropdownToggle(); }}
            >
              <span className={selectedName ? undefined : styles.dropdownPlaceholder}>
                {selectedName ?? "Select village"}
              </span>
              <span className={`${styles.dropdownArrow} ${dropdownOpen ? styles.dropdownArrowOpen : ""}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>
            {dropdownOpen && (
              <div className={styles.dropdownMenu}>
                <button
                  className={`${styles.dropdownItem} ${!selectedVillageId ? styles.dropdownItemActive : ""}`}
                  onClick={() => { onResetToAll(); onDropdownToggle(); }}
                >
                  All villages
                </button>
                {[...villages].sort((a, b) => a.name.localeCompare(b.name)).map((v) => (
                  <button
                    key={v.id}
                    className={`${styles.dropdownItem} ${selectedVillageId === v.id ? styles.dropdownItemActive : ""}`}
                    onClick={() => { onSelectVillage(v.id); onDropdownToggle(); }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedVillageId && (
            <>
              <h4>Restaurants</h4>
              {restaurants.length === 0 ? (
                <div className={styles.muted}>None in this village.</div>
              ) : (
                restaurants.map((p) => (
                  <button key={p.id} className={styles.item} onClick={() => onSelectPlace(p.id)}>
                    {p.name}
                  </button>
                ))
              )}

              <h4>Attractions</h4>
              {attractions.length === 0 ? (
                <div className={styles.muted}>None in this village.</div>
              ) : (
                attractions.map((p) => (
                  <button key={p.id} className={styles.item} onClick={() => onSelectPlace(p.id)}>
                    {p.name}
                  </button>
                ))
              )}

              <h4>Hotels</h4>
              {hotels.length === 0 ? (
                <div className={styles.muted}>None in this village.</div>
              ) : (
                hotels.map((p) => (
                  <button key={p.id} className={styles.item} onClick={() => onSelectPlace(p.id)}>
                    {p.name}
                  </button>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
