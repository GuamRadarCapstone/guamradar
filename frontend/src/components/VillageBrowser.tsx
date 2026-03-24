import { useRef, useEffect, useMemo, useLayoutEffect, useState, memo } from "react";
import type { Village, Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";

const VILLAGE_CATEGORY_SECTIONS = [
  { key: "RESTAURANT", label: "Restaurants" },
  { key: "ATTRACTION", label: "Attractions" },
  { key: "HOTEL", label: "Hotels" },
  { key: "SHOPPING", label: "Shopping" },
  { key: "SERVICE", label: "Services" },
  { key: "SCHOOL", label: "Schools" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "BASE", label: "Bases" },
  { key: "HOSPITAL", label: "Hospitals" },
] as const;

export const VillageBrowser = memo(function VillageBrowser({
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
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const cardBodyRef = useRef<HTMLDivElement>(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number>(260);

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

  useLayoutEffect(() => {
    if (!dropdownOpen) return;

    const updateMaxHeight = () => {
      const trigger = dropdownTriggerRef.current;
      const body = cardBodyRef.current;
      if (!trigger || !body) return;

      const triggerRect = trigger.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const spaceBelowTrigger = bodyRect.bottom - triggerRect.bottom - 8;
      const clamped = Math.max(0, Math.min(260, Math.floor(spaceBelowTrigger)));
      setDropdownMaxHeight(clamped);
    };

    updateMaxHeight();

    window.addEventListener("resize", updateMaxHeight);
    const observer = new ResizeObserver(updateMaxHeight);
    if (cardBodyRef.current) observer.observe(cardBodyRef.current);

    return () => {
      window.removeEventListener("resize", updateMaxHeight);
      observer.disconnect();
    };
  }, [dropdownOpen]);

  const sortedVillages = useMemo(
    () => [...villages].sort((a, b) => a.name.localeCompare(b.name)),
    [villages],
  );

  const selectedName = selectedVillageId
    ? villages.find((v) => v.id === selectedVillageId)?.name ?? "Select village"
    : null;

  return (
    <div className={`${styles.card} ${!isOpen ? styles.cardCollapsed : ""}`}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <div className={styles.bigTextSmall}>Browse by Village</div>
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
          <div className={styles.cardBody} ref={cardBodyRef}>
            <div className={styles.dropdown} ref={dropdownRef}>
              <button
                className={styles.dropdownTrigger}
                ref={dropdownTriggerRef}
                onClick={(e) => {
                  e.stopPropagation();
                  onDropdownToggle();
                }}
              >
                <span className={selectedName ? undefined : styles.dropdownPlaceholder}>
                  {selectedName ?? "Select village"}
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
                style={dropdownOpen ? { maxHeight: `${dropdownMaxHeight}px` } : undefined}
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
                  All villages
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
                    <div key={section.key}>
                      <h4>{section.label}</h4>
                      {items.length === 0 ? (
                        <div className={styles.muted}>None in this village.</div>
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