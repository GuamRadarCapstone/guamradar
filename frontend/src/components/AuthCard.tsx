import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  onSignedIn?: () => void;
};

export default function AuthCard({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) onSignedIn?.();
    });

    return () => subscription.unsubscribe();
  }, [onSignedIn]);

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

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for the login link.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Login failed.");
    }

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMessage("Signed out.");
  }

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px",
        marginBottom: "1rem",
        background: "#111",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Account</h3>

      {userEmail ? (
        <>
          <p style={{ marginTop: 0 }}>Signed in as: {userEmail}</p>
          <button onClick={handleLogout}>Log out</button>
        </>
      ) : (
        <>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Sign in to save POIs and build/share itineraries.
          </p>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "0.6rem",
              borderRadius: "8px",
              border: "1px solid #555",
              width: "100%",
              marginBottom: "0.75rem",
              background: "#0d0d0d",
              color: "white",
            }}
          />
          <button onClick={handleLogin} disabled={loading}>
            {loading ? "Sending..." : "Send login link"}
          </button>
        </>
      )}

      {message && <p style={{ marginTop: "0.75rem" }}>{message}</p>}
    </div>
  );
}