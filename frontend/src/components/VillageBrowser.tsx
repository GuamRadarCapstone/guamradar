import { useRef, useEffect, useMemo, memo } from "react";
import type { Village, Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, categoryLabel, t } from "../lib/i18n";

const VILLAGE_CATEGORY_SECTIONS = [
  { key: "RESTAURANT" },
  { key: "ATTRACTION" },
  { key: "HOTEL" },
  { key: "SHOPPING" },
  { key: "SERVICE" },
  { key: "SCHOOL" },
  { key: "TRANSPORT" },
  { key: "BASE" },
  { key: "HOSPITAL" },
] as const;

export const VillageBrowser = memo(function VillageBrowser({
  lang,
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
  lang: Language;
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

  useEffect(() => {
    if (!isOpen && dropdownOpen) onDropdownToggle();
  }, [isOpen, dropdownOpen, onDropdownToggle]);

  const sortedVillages = useMemo(
    () => [...villages].sort((a, b) => a.name.localeCompare(b.name)),
    [villages],
  );

  const selectedName = selectedVillageId
    ? villages.find((v) => v.id === selectedVillageId)?.name ?? t(lang, "selectVillage")
    : null;

  return (
    <div className={`${styles.card} ${!isOpen ? styles.cardCollapsed : ""}`}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <div className={styles.bigTextSmall}>{t(lang, "browseByVillage")}</div>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      <div
        className={`${styles.collapsible} ${isOpen ? styles.collapsibleOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.collapsibleInner}>
          <div className={styles.cardBody}>
            <div className={styles.dropdown} ref={dropdownRef}>
              <button
                className={styles.dropdownTrigger}

                onClick={(e) => {
                  e.stopPropagation();
                  onDropdownToggle();
                }}
              >
                <span className={selectedName ? undefined : styles.dropdownPlaceholder}>
                  {selectedName ?? t(lang, "selectVillage")}
                </span>
                <span
                  className={`${styles.dropdownArrow} ${
                    dropdownOpen ? styles.dropdownArrowOpen : ""
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              <div
                className={`${styles.dropdownMenu} ${
                  dropdownOpen ? styles.dropdownMenuOpen : ""
                }`}
                aria-hidden={!dropdownOpen}
              >
                <button
                  className={`${styles.dropdownItem} ${
                    !selectedVillageId ? styles.dropdownItemActive : ""
                  }`}
                  onClick={() => {
                    onResetToAll();
                    onDropdownToggle();
                  }}
                >
                  {t(lang, "allVillages")}
                </button>

                {sortedVillages.map((v) => (
                  <button
                    key={v.id}
                    className={`${styles.dropdownItem} ${
                      selectedVillageId === v.id ? styles.dropdownItemActive : ""
                    }`}
                    onClick={() => {
                      onSelectVillage(v.id);
                      onDropdownToggle();
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedVillageId && (
              <>
                {VILLAGE_CATEGORY_SECTIONS.map((section) => {
                  const items = villagePlaces.filter(
                    (place) => (place.category ?? place.type) === section.key,
                  );

                  return (
                    <div key={section.key} style={{ marginTop: 16 }}>
                      <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{categoryLabel(section.key, lang)}</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.length === 0 ? (
                          <div className={styles.muted}>{t(lang, "noneInVillage")}</div>
                        ) : (
                          items.map((p) => (
                            <button
                              key={p.id}
                              className={styles.item}
                              onClick={() => onSelectPlace(p.id)}
                            >
                              {p.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});