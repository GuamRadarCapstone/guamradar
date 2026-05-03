import { useMemo, useState } from "react";
import type { Place } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, categoryLabel, t } from "../lib/i18n";

export type ItineraryRow = {
  id: string;
  title: string;
  share_token: string;
  is_public: boolean;
};

export type ItineraryItemRow = {
  id: number;
  itinerary_id: string;
  poi_id: string;
  notes: string | null;
  sort_order: number;
  day_number: number;
};

function buildShareLink(shareToken: string) {
  return `${window.location.origin}${window.location.pathname}?share=${shareToken}`;
}

export function ItineraryCard({
  lang,
  currentPlace,
  itineraries,
  itineraryItems,
  allPlaces,
  activeItineraryId,
  onSetActiveItinerary,
  onCreateItinerary,
  onAddPlaceToItinerary,
  onRemoveItem,
  onMoveItem,
  onTogglePublic,
  onUpdateItem,
  onCopySummary,
}: {
  lang: Language;
  currentPlace: Place | null;
  itineraries: ItineraryRow[];
  itineraryItems: ItineraryItemRow[];
  allPlaces: Place[];
  activeItineraryId: string | null;
  onSetActiveItinerary: (id: string | null) => void;
  onCreateItinerary: (title: string) => Promise<void>;
  onAddPlaceToItinerary: (itineraryId: string, poiId: string) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onMoveItem: (itemId: number, dir: "up" | "down") => Promise<void>;
  onTogglePublic: (itineraryId: string, nextValue: boolean) => Promise<void>;
  onUpdateItem: (itemId: number, patch: { notes?: string; day_number?: number }) => Promise<void>;
  onCopySummary: (itineraryId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const placeMap = useMemo(() => new Map(allPlaces.map((p) => [p.id, p])), [allPlaces]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(buildShareLink(token));
    alert(t(lang, "shareCopied"));
  }

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "2px 0" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={styles.bigTextSmall}>{t(lang, "itineraries")}</span>
          <span className={styles.badge}>{itineraries.length}</span>
        </div>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && (
      <div style={{ marginTop: 10 }}>
        <div className={styles.row} style={{ marginBottom: 12 }}>
          <input
            className={styles.input}
            placeholder={t(lang, "newItineraryTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className={styles.btnPrimary}
            onClick={async () => {
              const clean = title.trim();
              if (!clean) return;
              await onCreateItinerary(clean);
              setTitle("");
            }}
          >
            Create
          </button>
        </div>

        {itineraries.length === 0 ? (
          <div className={styles.muted}>{t(lang, "noItineraries")}</div>
        ) : (
          itineraries.map((itinerary) => {
            const items = itineraryItems
              .filter((x) => x.itinerary_id === itinerary.id)
              .sort((a, b) => a.sort_order - b.sort_order);

            const shareLink = buildShareLink(itinerary.share_token);
            const mailto = `mailto:?subject=${encodeURIComponent(
              `${t(lang, "emailSubjectPrefix")}: ${itinerary.title}`,
            )}&body=${encodeURIComponent(
              `${t(lang, "emailBodyIntro")}:\n\n${shareLink}`,
            )}`;

            const isActive = activeItineraryId === itinerary.id;

            return (
              <div
                key={itinerary.id}
                style={{
                  border: isActive
                    ? "1px solid rgba(69,217,168,0.65)"
                    : "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div className={styles.rowBetween} style={{ gap: 8 }}>
                  <div
                    style={{ cursor: "pointer", minWidth: 0 }}
                    onClick={() => onSetActiveItinerary(isActive ? null : itinerary.id)}
                  >
                    <div className={styles.detailTitle}>{itinerary.title}</div>
                    <div className={styles.muted}>
                      {itinerary.is_public ? t(lang, "publicShareEnabled") : t(lang, "private")}
                      {isActive ? " • " + t(lang, "showingOnMap") : ""}
                    </div>
                  </div>

                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={itinerary.is_public}
                      onChange={(e) => onTogglePublic(itinerary.id, e.target.checked)}
                    />{" "}
                    {t(lang, "publicShare")}
                  </label>
                </div>

                {currentPlace && (
                  <div className={styles.row} style={{ marginTop: 8 }}>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => onAddPlaceToItinerary(itinerary.id, currentPlace.id)}
                    >
                      {t(lang, "addSelectedPlace")}
                    </button>
                  </div>
                )}

                <div className={styles.row} style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button
                    className={styles.btn}
                    onClick={() => copyLink(itinerary.share_token)}
                    disabled={!itinerary.is_public}
                  >
                    {t(lang, "copyShareLink")}
                  </button>

                  <a
                    className={styles.btnPrimary}
                    href={mailto}
                    style={{
                      pointerEvents: itinerary.is_public ? "auto" : "none",
                      opacity: itinerary.is_public ? 1 : 0.5,
                    }}
                  >
                    {t(lang, "emailItinerary")}
                  </a>

                  <button className={styles.btn} onClick={() => onCopySummary(itinerary.id)}>
                    {t(lang, "copySummary")}
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {items.length === 0 ? (
                    <div className={styles.muted}>{t(lang, "noPlacesYet")}</div>
                  ) : (
                    items.map((item, index) => {
                      const place = placeMap.get(item.poi_id);
                      const expanded = expandedItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: "8px 0",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div className={styles.rowBetween} style={{ gap: 8 }}>
                            <div
                              style={{ minWidth: 0, cursor: "pointer" }}
                              onClick={() => setExpandedItemId(expanded ? null : item.id)}
                            >
                              <div>
                                {t(lang, "day")} {item.day_number} • {place?.name ?? item.poi_id}
                              </div>
                              <div className={styles.muted}>{place?.type ? categoryLabel(place.type, lang) : ""}</div>
                            </div>

                            <div className={styles.row} style={{ gap: 6, flexWrap: "wrap" }}>
                              <button
                                className={styles.btn}
                                onClick={() => onMoveItem(item.id, "up")}
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                className={styles.btn}
                                onClick={() => onMoveItem(item.id, "down")}
                                disabled={index === items.length - 1}
                              >
                                ↓
                              </button>
                              <button className={styles.btn} onClick={() => onRemoveItem(item.id)}>
                                {t(lang, "remove")}
                              </button>
                            </div>
                          </div>

                          {expanded && (
                            <div style={{ marginTop: 10 }}>
                              <div className={styles.row} style={{ gap: 8, marginBottom: 8 }}>
                                <label className={styles.muted}>{t(lang, "day")}</label>
                                <input
                                  className={styles.input}
                                  type="number"
                                  min={1}
                                  value={item.day_number}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, {
                                      day_number: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  style={{ maxWidth: 90 }}
                                />
                              </div>

                              <textarea
                                className={styles.input}
                                placeholder={t(lang, "notesForStop")}
                                value={item.notes ?? ""}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    notes: e.target.value,
                                  })
                                }
                                style={{ minHeight: 80, resize: "vertical" }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}