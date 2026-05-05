import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import styles from "../pages/HomePage/HomePage.module.css";
import { type Language, t } from "../lib/i18n";

type Props = {
  lang: Language;
  onSignedIn?: () => void;
  onAuthChange?: (signedIn: boolean) => void;
};

export default function AuthCard({ lang, onSignedIn, onAuthChange }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState("");

  const isSignedIn = !!userEmail || demoMode;

  const notifyAuth = useCallback(
    (signedIn: boolean) => onAuthChange?.(signedIn),
    [onAuthChange],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? null;
      setUserEmail(email);
      notifyAuth(!!email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      notifyAuth(!!email);
      if (session?.user) onSignedIn?.();
    });

    return () => subscription.unsubscribe();
  }, [onSignedIn, notifyAuth]);

  useEffect(() => {
    notifyAuth(isSignedIn);
  }, [isSignedIn, notifyAuth]);

  async function handleLogin() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
        emailRedirectTo:
            window.location.hostname === "localhost"
    ?       "http://localhost:5173"
    :       "https://guamradar.com",        },
      });
      if (error) setMessage(error.message);
      else setMessage(t(lang, "loginLinkSent"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t(lang, "loginFailed"));
    }
    setLoading(false);
  }

  async function handleLogout() {
    if (demoMode) {
      setDemoMode(false);
      setMessage("");
      return;
    }
    await supabase.auth.signOut();
    setUserEmail(null);
    setMessage("");
  }

  const displayEmail = demoMode ? "demo@guamradar.com" : userEmail;

  return (
    <div>
      {isSignedIn ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(43,181,160,0.12)",
              border: "1px solid rgba(43,181,160,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(94,232,200,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{displayEmail}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {demoMode ? t(lang, "demoAccount") : t(lang, "signedMagic")}
              </div>
            </div>
            <button className={styles.btn} onClick={handleLogout} style={{ flexShrink: 0 }}>
              {t(lang, "signOut")}
            </button>
          </div>
          {demoMode && (
            <div className={styles.notice} style={{ marginBottom: 8 }}>
              {t(lang, "demoLocal")}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <div className={styles.muted} style={{ marginBottom: 12 }}>
              {t(lang, "signInSave")}
            </div>
            <div className={styles.section}>
              <input
                className={styles.input}
                type="email"
                placeholder={t(lang, "enterEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              />
              <button
                className={styles.btnPrimary}
                onClick={handleLogin}
                disabled={loading}
                style={{ width: "100%" }}
              >
                {loading ? t(lang, "sending") : t(lang, "sendLoginLink")}
              </button>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
            <button
              className={styles.btn}
              onClick={() => setDemoMode(true)}
              style={{ width: "100%", opacity: 0.7 }}
            >
              {t(lang, "previewSignedIn")}
            </button>
          </div>
        </>
      )}

      {message && (
        <div className={styles.notice} style={{ marginTop: 10 }}>
          {message}
        </div>
      )}
    </div>
  );
}
