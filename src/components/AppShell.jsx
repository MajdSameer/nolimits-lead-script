"use client";

import { useEffect, useState } from "react";
import LeadToScript from "./LeadToScript";
import Gate from "./Gate";

/* Auth gate wrapper: checks the session cookie once on load, shows the
   passcode screen until a valid session exists, then the app. */
export default function AppShell() {
  const [status, setStatus] = useState("checking"); // checking | gate | app

  useEffect(() => {
    let alive = true;
    fetch("/api/auth", { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setStatus(d?.authed ? "app" : "gate");
      })
      .catch(() => {
        if (alive) setStatus("gate");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16295F",
          color: "#FFC72C",
          fontFamily: "'Space Mono', ui-monospace, monospace",
          fontSize: "0.8rem",
        }}
      >
        loading…
      </div>
    );
  }

  if (status === "gate") {
    return <Gate onUnlock={() => setStatus("app")} />;
  }

  return <LeadToScript />;
}
