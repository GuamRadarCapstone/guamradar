import { memo } from "react";
import type { Place, EventItem } from "../types/data";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, categoryLabel, t } from "../lib/i18n";

type SelectedDetail =
  | { kind: "PLACE"; p: Place }
  | { kind: "EVENT"; e: EventItem }
  | null;

export const DetailsPanel = memo(function DetailsPanel({
  lang,
  selectedDetail,
  isOpen,
  onToggle,
  canSave,
  isSaved,
  onToggleSave,
}: {
  lang: Language;
  selectedDetail: SelectedDetail;
  isOpen: boolean;
  onToggle: () => void;
  canSave: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  return (
    <div className={`${styles.card} ${!isOpen ? styles.cardCollapsed : ""}`}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <div className={styles.bigTextSmall}>{t(lang, "details")}</div>
        <div className={styles.row}>
          {selectedDetail && (
            <div className={styles.badge}>
              {selectedDetail.kind === "PLACE" ? categoryLabel(selectedDetail.p.type, lang) : categoryLabel(selectedDetail.e.status, lang)}
            </div>
          )}
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
      </div>

      <div
        className={`${styles.collapsible} ${isOpen ? styles.collapsibleOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.collapsibleInner}>
          <div className={styles.cardBody}>
            {!selectedDetail ? (
              <div className={styles.muted}>{t(lang, "noDetail")}</div>
            ) : selectedDetail.kind === "PLACE" ? (
              <>
                <div className={styles.detailTitle}>{selectedDetail.p.name}</div>
                <div className={styles.muted}>
                  {selectedDetail.p.source} • {selectedDetail.p.price}
                </div>
                <div className={styles.detailText}>{selectedDetail.p.description ?? ""}</div>
                <div className={styles.row} style={{ gap: 8, flexWrap: "wrap" }}>
                  <a
                    className={styles.btnPrimary}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps?q=${selectedDetail.p.lat},${selectedDetail.p.lng}`}
                  >
                    {t(lang, "directions")}
                  </a>

                  {canSave && (
                    <button className={styles.btn} onClick={onToggleSave}>
                      {isSaved ? t(lang, "removeSavedPoi") : t(lang, "savePoi")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.detailTitle}>{selectedDetail.e.title}</div>
                <div className={styles.muted}>{selectedDetail.e.when ?? ""}</div>
                <div className={styles.detailText}>{selectedDetail.e.description ?? ""}</div>
                <div className={styles.row}>
                  <a
                    className={styles.btnPrimary}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps?q=${selectedDetail.e.lat},${selectedDetail.e.lng}`}
                  >
                    {t(lang, "directions")}
                  </a>
                </div>
              </>
            )}
            <div className={styles.footerNote}>
              {t(lang, "footerNote")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});