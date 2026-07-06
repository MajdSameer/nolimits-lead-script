"use client";

import { useState } from "react";

const C = {
  navy: "#16295F",
  navyDeep: "#0F1E47",
  yellow: "#FFC72C",
  yellowSoft: "#FFF4CF",
  line: "#33487F",
  ink: "#A9B4CE",
};
const FONT_HEAD = "'Archivo', system-ui, sans-serif";
const FONT_MONO = "'Space Mono', ui-monospace, monospace";
const FONT_BODY = "'Inter', system-ui, sans-serif";

/* First-load gate: rep enters the shared team passcode once. On success the
   server sets an httpOnly session cookie and we drop them into the app. */
export default function Gate({ onUnlock }) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy || !passcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "That passcode didn't work.");
        setBusy(false);
        return;
      }
      onUnlock();
    } catch {
      setError("Couldn't reach the server — try again.");
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: FONT_BODY,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box}
        input:focus, button:focus-visible { outline: 2px solid ${C.yellow}; outline-offset: 2px; }
      `}</style>
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: C.navyDeep,
          border: `1px solid ${C.line}`,
          borderTop: `3px solid ${C.yellow}`,
          borderRadius: 16,
          padding: "26px 22px",
        }}
      >
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 800,
            fontSize: "1.15rem",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          No <span style={{ color: C.yellow }}>Limits</span> Removalists
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.68rem",
            color: C.ink,
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          Lead → Script · team access
        </div>

        <label
          style={{
            display: "block",
            fontFamily: FONT_MONO,
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.ink,
            marginBottom: 6,
          }}
        >
          Team passcode
        </label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="enter passcode"
          autoFocus
          autoComplete="current-password"
          style={{
            width: "100%",
            background: "#22376F",
            border: `1px solid ${C.line}`,
            color: "#fff",
            borderRadius: 10,
            padding: "11px 13px",
            fontFamily: FONT_MONO,
            fontSize: "0.9rem",
          }}
        />

        {error && (
          <div
            style={{
              marginTop: 12,
              background: C.yellowSoft,
              border: `1px solid ${C.yellow}`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: "0.82rem",
              color: C.navy,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !passcode.trim()}
          style={{
            width: "100%",
            marginTop: 16,
            background: busy || !passcode.trim() ? "#3A4E86" : C.yellow,
            color: busy || !passcode.trim() ? "#9AA7C8" : C.navy,
            border: "none",
            borderRadius: 10,
            padding: "12px 22px",
            fontFamily: FONT_HEAD,
            fontWeight: 800,
            fontSize: "0.9rem",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            cursor: busy || !passcode.trim() ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
