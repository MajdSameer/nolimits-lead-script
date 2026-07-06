"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  No Limits — Lead → Script v3                                       */
/*  Adds: L·A·E·R·C objection framework, psychology layer,             */
/*  Feel-Felt-Found, and Practice Mode (AI customer + scored debrief). */
/*                                                                      */
/*  Ported to a Next.js client component: the three model calls now go */
/*  through server API routes (/api/parse, /api/customer, /api/grade)  */
/*  so the Anthropic key never reaches the client. Script copy is      */
/*  unchanged from the approved artifact.                              */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#F3F5F9",
  surface: "#FFFFFF",
  navy: "#16295F",
  navyDeep: "#0F1E47",
  ink2: "#5A6478",
  line: "#DDE2EC",
  line2: "#EAEDF4",
  yellow: "#FFC72C",
  yellowSoft: "#FFF4CF",
  doBg: "#EAF0FA",
  doLine: "#C9D5EC",
  good: "#1E7A4F",
  bad: "#B23A3A",
};

const FONT_HEAD = "'Archivo', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'Space Mono', monospace";

const JSON_HEADERS = { "content-type": "application/json" };

/* ---------------------------- helpers ----------------------------- */

function parseDateSafe(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(iso) {
  const d = parseDateSafe(iso);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDate(iso) {
  const d = parseDateSafe(iso);
  if (!d) return null;
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function fmtShort(iso) {
  const d = parseDateSafe(iso);
  if (!d) return null;
  return `${DAYS_S[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function midweekInWindow(startISO, endISO) {
  const s = parseDateSafe(startISO);
  const e = parseDateSafe(endISO);
  if (!s || !e) return [];
  const out = [];
  const cur = new Date(s);
  let guard = 0;
  while (cur <= e && guard < 90) {
    const dow = cur.getDay();
    if (dow >= 2 && dow <= 4) out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

function money(n) {
  if (n === null || n === undefined || n === "" || isNaN(Number(n))) return null;
  return "$" + Number(n).toLocaleString("en-AU");
}

function mapsSearchUrl(loc) {
  if (!loc) return null;
  const q = [loc.address, loc.suburb, loc.state].filter(Boolean).join(", ");
  if (!q) return null;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

function mapsRouteUrl(a, b) {
  const qa = a ? [a.address, a.suburb, a.state].filter(Boolean).join(", ") : "";
  const qb = b ? [b.address, b.suburb, b.state].filter(Boolean).join(", ") : "";
  if (!qa || !qb) return null;
  return (
    "https://www.google.com/maps/dir/?api=1&origin=" +
    encodeURIComponent(qa) +
    "&destination=" +
    encodeURIComponent(qb)
  );
}

/* ---------------- server calls (key stays server-side) ------------ */

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Request failed.");
    err.data = data;
    throw err;
  }
  return data;
}

/* ------------------------- lever engine --------------------------- */

function computeLevers(p) {
  const levers = [];
  const start = p.moveDateStart;
  const end = p.moveDateEnd;
  const flexible = !!(p.dateFlexible && start && end && end !== start);
  const d = parseDateSafe(start);
  const dow = d ? d.getDay() : null;
  const until = daysUntil(start);
  const midweekDates = flexible ? midweekInWindow(start, end) : [];

  if (flexible)
    levers.push({
      id: "FLEX",
      label: `flexible window ${fmtShort(start)} → ${fmtShort(end)}`,
      why:
        midweekDates.length > 0
          ? `Customer gave a date window — steer them to a Tue–Thu inside it (${midweekDates
              .slice(0, 3)
              .map(fmtShort)
              .join(", ")}) for the Midweek Mover Deal. Better price for them, fills our quieter days.`
          : "Customer gave a date window with no midweek days in it — lock a specific day early before the week fills.",
      midweekDates,
    });

  if (!flexible && (dow === 5 || dow === 6))
    levers.push({
      id: "SCARCITY",
      label: dow === 6 ? "Saturday move" : "Friday move",
      why: "Fri/Sat run at highest capacity and book out first — the scarcity close is TRUE, so it lands.",
    });

  if (!flexible && dow !== null && dow >= 2 && dow <= 4)
    levers.push({
      id: "MIDWEEK",
      label: `${DAYS[dow]} move`,
      why: "Tue–Thu qualifies for the Midweek Mover Deal — the discount becomes the closing lever.",
    });

  if (until !== null && until >= 0 && until <= 7)
    levers.push({
      id: "URGENT",
      label: flexible ? `window opens in ${until}d` : `moving in ${until} day${until === 1 ? "" : "s"}`,
      why: "Under a week out — compress the open, go straight to availability and lock-in.",
    });

  if (p.likelyOver140km || p.distanceCategory === "interstate" || p.distanceCategory === "regional")
    levers.push({
      id: "LONG_DISTANCE",
      label:
        p.distanceCategory === "interstate"
          ? "interstate route"
          : "long-distance route (140km+ territory)",
      why: "Goods out of sight longer — insurance + experienced-crew trust points get more airtime. Customer is likely comparing backloaders.",
    });

  const big = (p.beds !== null && p.beds >= 4) || (p.cubicMetres !== null && p.cubicMetres >= 30);
  const access = !!(p.accessNotes && p.accessNotes.trim());
  if (big || access)
    levers.push({
      id: "INSPECTION",
      label: big ? "big move" + (access ? " + access issues" : "") : "access issues",
      why: "Complex job — the free site inspection with an exact locked price is the strongest offer here. 'No surprises on the day' hits hardest.",
    });

  if (big)
    levers.push({
      id: "THIRD_MAN",
      label: "size justifies 3rd man",
      why: "+25% third man framed as time saved, not a surcharge.",
    });

  if (p.competitorMention && p.competitorMention.mentioned)
    levers.push({
      id: "PRICE_DEFENSE",
      label: "competitor quote in play",
      why: "No-hidden-fees breakdown gets promoted from the objection deck into the Presentation — defuse it before it's raised.",
    });

  const signals = (p.customerSignals || []).map((s) => String(s).toLowerCase());
  if (signals.some((s) => /first|nervous|anxious|never moved|stress/.test(s)))
    levers.push({
      id: "TRUST_OPEN",
      label: "first-time / nervous signals",
      why: "Insurance + reviews trust line moves into the Open instead of waiting for the Close.",
    });

  if (p.vehicleMove)
    levers.push({
      id: "VEHICLE_GST",
      label: "vehicle in the move",
      why: "GST treatment on vehicle transport differs from removals — quote it correctly on the call.",
    });

  return levers;
}

const has = (levers, id) => levers.some((l) => l.id === id);
const lever = (levers, id) => levers.find((l) => l.id === id);

/* --------------------------- UI atoms ----------------------------- */

function Var({ children, filled }) {
  return (
    <span
      style={{
        borderBottom: `2px dotted ${filled ? C.yellow : "#9AA3B5"}`,
        color: filled ? C.navy : C.ink2,
        fontWeight: filled ? 700 : 500,
        padding: "0 2px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function V({ value, fallback }) {
  return value ? <Var filled>{value}</Var> : <Var>{fallback}</Var>;
}

function MapLink({ href, children }) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: C.navy, fontWeight: 700, textDecorationColor: C.yellow, textDecorationThickness: 2 }}
    >
      {children} <span style={{ fontSize: "0.75em" }}>↗</span>
    </a>
  );
}

function LeverChip({ text }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: C.yellow, color: C.navy, borderRadius: 999, padding: "3px 11px",
        fontFamily: FONT_MONO, fontSize: "0.66rem", fontWeight: 700,
        letterSpacing: "0.02em", textTransform: "uppercase",
      }}
    >
      ▲ {text}
    </span>
  );
}

const LAERC_INFO = {
  L: ["Listen", "let them finish — never argue"],
  A: ["Acknowledge", "validate before you answer"],
  E: ["Explore", "find the real objection & trap it"],
  R: ["Respond", "resolve the real one, no pressure"],
  C: ["Confirm", "check it's cleared before re-closing"],
  LOCK: ["Lock", "exact next step, always"],
};

function LaercBadge({ code }) {
  const info = LAERC_INFO[code] || [code, ""];
  return (
    <span
      title={`${info[0]} — ${info[1]}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: code === "LOCK" ? 44 : 22, height: 22,
        background: code === "LOCK" ? C.navy : C.yellow,
        color: code === "LOCK" ? C.yellow : C.navy,
        borderRadius: 6, fontFamily: FONT_MONO, fontSize: "0.62rem", fontWeight: 700,
        padding: "0 4px", flexShrink: 0,
      }}
    >
      {code === "LOCK" ? "🔒" : code.replace("+", "·")}
    </span>
  );
}

function Tag({ kind }) {
  const say = kind === "say";
  return (
    <span
      style={{
        display: "inline-block",
        background: say ? C.yellow : C.navy,
        color: say ? C.navy : "#fff",
        borderRadius: 6, padding: "2px 9px",
        fontFamily: FONT_MONO, fontSize: "0.62rem", fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7,
      }}
    >
      {say ? "Say this" : "Do this"}
    </span>
  );
}

function Say({ children, chip, sub }) {
  return (
    <div
      style={{
        background: C.surface, border: `1px solid ${C.line}`,
        borderLeft: `4px solid ${C.yellow}`, borderRadius: 12,
        padding: "13px 16px", marginBottom: 10,
      }}
    >
      {chip && <div style={{ marginBottom: 8 }}>{chip}</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <Tag kind="say" />
        {sub && (
          <span style={{ fontFamily: FONT_MONO, fontSize: "0.62rem", color: C.ink2, textTransform: "uppercase" }}>
            {sub}
          </span>
        )}
      </div>
      <div style={{ fontSize: "1.02rem", lineHeight: 1.6, color: C.navyDeep }}>{children}</div>
    </div>
  );
}

function Do({ children, chip }) {
  return (
    <div
      style={{
        background: C.doBg, border: `1px solid ${C.doLine}`,
        borderLeft: `4px solid ${C.navy}`, borderRadius: 12,
        padding: "12px 16px", marginBottom: 10,
      }}
    >
      {chip && <div style={{ marginBottom: 8 }}>{chip}</div>}
      <Tag kind="do" />
      <div style={{ fontSize: "0.92rem", lineHeight: 1.55, color: C.navy }}>{children}</div>
    </div>
  );
}

function Pills({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
      {items.map((t) => (
        <span
          key={t}
          style={{
            background: C.yellowSoft, border: `1px solid ${C.yellow}`, color: C.navy,
            borderRadius: 999, padding: "4px 12px", fontSize: "0.8rem", fontWeight: 600,
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function StageHead({ num, title, sub }) {
  return (
    <div style={{ margin: "34px 0 14px", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: "0.8rem", fontWeight: 700, color: C.yellow, background: C.navy, borderRadius: 6, padding: "2px 8px" }}>
        {num}
      </span>
      <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.35rem", letterSpacing: "-0.02em", textTransform: "uppercase", margin: 0, color: C.navy }}>
        {title}
      </h2>
      {sub && <span style={{ fontSize: "0.78rem", color: C.ink2, fontFamily: FONT_MONO }}>{sub}</span>}
    </div>
  );
}

function Field({ label, value, link }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.ink2, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.95rem", fontWeight: value ? 600 : 400, color: value ? C.navyDeep : C.ink2, fontStyle: value ? "normal" : "italic", overflowWrap: "break-word" }}>
        {value ? (link ? <MapLink href={link}>{value}</MapLink> : value) : "— not in lead"}
      </div>
    </div>
  );
}

/* --------------------------- main app ----------------------------- */

export default function LeadToScript() {
  const [raw, setRaw] = useState("");
  const [rep, setRep] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [p, setP] = useState(null);
  const [openAcc, setOpenAcc] = useState(null);
  const [callType, setCallType] = useState("outbound");

  /* practice state */
  const [mode, setMode] = useState("script");
  const [difficulty, setDifficulty] = useState("standard");
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [grade, setGrade] = useState(null);
  const [grading, setGrading] = useState(false);

  /* ---- logging (fire-and-forget; never blocks or breaks flow) ---- */
  const logEvent = (payload) => {
    try {
      fetch("/api/log", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const logScriptGenerated = (parsed) => {
    const lv = computeLevers(parsed);
    logEvent({
      type: "script_generated",
      rep: rep.trim(),
      customerFirstName: parsed?.customerName ? parsed.customerName.split(" ")[0] : null,
      routeFrom: parsed?.pickup?.suburb || null,
      routeTo: parsed?.delivery?.suburb || null,
      distanceCategory: parsed?.distanceCategory || null,
      levers: lv.map((l) => l.id).join(","),
      flexibleWindow: has(lv, "FLEX"),
      quotedPrice: price ? Number(price) : null,
    });
  };

  const logPracticeScored = (g, turns) => {
    const stageScores = (g?.stages || []).map((s) => s.score);
    const laercOrder = ["listen", "acknowledge", "explore", "respond", "confirm"];
    const laerc = g?.laerc ? laercOrder.map((k) => !!g.laerc[k]) : [];
    logEvent({
      type: "practice_scored",
      rep: rep.trim(),
      difficulty,
      overall: g?.overall ?? null,
      stageScores,
      laerc,
      turns,
    });
  };

  const run = async () => {
    if (!rep.trim()) {
      setError("Add your name (top right) before building a script.");
      return;
    }
    setLoading(true);
    setError(null);
    setP(null);
    setChat([]);
    setChatError(null);
    setGrade(null);
    try {
      const data = await postJson("/api/parse", { rawText: raw, rep: rep.trim() });
      const parsed = data.parsed;
      setP(parsed);
      logScriptGenerated(parsed);
      setTimeout(() => {
        const el = document.getElementById("move-card");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e.message || "Couldn't parse that lead. Check the pasted text and try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendRepLine = async () => {
    const line = draft.trim();
    if (!line || chatLoading || !p) return;
    if (!rep.trim()) {
      setChatError("Add your name (top right) before practising.");
      return;
    }
    const next = [...chat, { role: "rep", text: line }];
    setChat(next);
    setDraft("");
    setChatLoading(true);
    setChatError(null);
    try {
      const data = await postJson("/api/customer", {
        lead: p,
        difficulty,
        messages: next,
        rep: rep.trim(),
      });
      if (data.limit) {
        setChatError(data.message || "That's a full call — end it and get scored.");
        return;
      }
      setChat([...next, { role: "customer", text: (data.reply || "").trim() }]);
    } catch (e) {
      setChatError(e.message || "Line dropped — try sending that again.");
    } finally {
      setChatLoading(false);
    }
  };

  const endAndGrade = async () => {
    if (chat.length < 2 || grading || !p) return;
    if (!rep.trim()) {
      setChatError("Add your name (top right) before practising.");
      return;
    }
    setGrading(true);
    setGrade(null);
    setChatError(null);
    try {
      const data = await postJson("/api/grade", {
        lead: p,
        messages: chat,
        rep: rep.trim(),
      });
      const g = data.grade;
      setGrade(g);
      logPracticeScored(g, chat.length);
    } catch (e) {
      setGrade({ error: true });
    } finally {
      setGrading(false);
    }
  };

  const resetCall = () => {
    setChat([]);
    setGrade(null);
    setDraft("");
    setChatError(null);
  };

  const levers = p ? computeLevers(p) : [];
  const start = p?.moveDateStart || null;
  const end = p?.moveDateEnd || null;
  const flexible = has(levers, "FLEX");
  const flexLever = lever(levers, "FLEX");
  const until = p ? daysUntil(start) : null;
  const dateNice = fmtDate(start);
  const windowNice = flexible ? `${fmtShort(start)} → ${fmtShort(end)}` : null;
  const dateSpeak = flexible ? `between ${fmtShort(start)} and ${fmtShort(end)}` : dateNice;
  const name = p?.customerName ? p.customerName.split(" ")[0] : null;
  const from = p?.pickup?.suburb || p?.pickup?.address || null;
  const to = p?.delivery?.suburb || p?.delivery?.address || null;
  const fromLink = p ? mapsSearchUrl(p.pickup) : null;
  const toLink = p ? mapsSearchUrl(p.delivery) : null;
  const routeLink = p ? mapsRouteUrl(p.pickup, p.delivery) : null;
  const repName = rep.trim() || null;
  const quoted = money(price);

  const urgent = has(levers, "URGENT");
  const scarcity = has(levers, "SCARCITY");
  const midweek = has(levers, "MIDWEEK");
  const longDist = has(levers, "LONG_DISTANCE");
  const inspection = has(levers, "INSPECTION");
  const thirdMan = has(levers, "THIRD_MAN");
  const priceDef = has(levers, "PRICE_DEFENSE");
  const trustOpen = has(levers, "TRUST_OPEN");
  const vehicleGst = has(levers, "VEHICLE_GST");
  const mwDates = flexLever?.midweekDates || [];

  /* ---------- Presentation blocks ---------- */
  const uspBlocks = [];
  if (priceDef)
    uspBlocks.push(
      <Say key="nhf" chip={<LeverChip text={`promoted — ${lever(levers, "PRICE_DEFENSE").label}`} />}>
        With No Limits there are <b>no hidden fees</b>. Usually when quotes come in extremely cheap,
        there's a reason — they often leave out{" "}
        <em>wrapping, travel time, fuel, stairs, insurance, GST, depot fees, experienced staff</em>.
        Everything I quote you today is the full picture.
      </Say>
    );
  if (inspection)
    uspBlocks.push(
      <Say key="insp" chip={<LeverChip text={`promoted — ${lever(levers, "INSPECTION").label}`} />}>
        For a move like this I'd recommend our <b>free site inspection</b> — in person, or over a
        quick video call if that's easier — and your price is <b>locked in exact</b>. No surprises
        on the day.
      </Say>
    );
  if (longDist)
    uspBlocks.push(
      <Say key="trust" chip={<LeverChip text={`promoted — ${lever(levers, "LONG_DISTANCE").label}`} />}>
        On a run like{" "}
        {from && to ? (
          <>
            <V value={from} fallback="pickup" /> to <V value={to} fallback="delivery" />
          </>
        ) : (
          "this"
        )}
        , your goods are with us for the long haul — so it matters that we're <b>fully insured</b>,
        with careful, experienced crews and <b>over 5,000 five-star reviews</b> from moves just like
        yours.
      </Say>
    );
  uspBlocks.push(
    <Say key="truck">
      Based on the size of your <V value={p?.beds ? String(p.beds) : null} fallback="X" /> bedroom
      property, we'd recommend an <Var>X</Var> tonne truck, which holds approximately <Var>X</Var> m³.
    </Say>
  );
  uspBlocks.push(
    <Say key="pricing" sub="pricing">
      The pricing is simple: <Var>$xxx</Var> per hour, with a minimum of <Var>X</Var> hours.
    </Say>
  );
  uspBlocks.push(
    <Say key="incl" sub="included">
      And included in that rate:
      <Pills
        items={[
          "Public Liability up to $20M",
          "Marine & Transit Insurance",
          "Workers Comp cover",
          "equipment & furniture protection",
          "professional moving equipment",
        ]}
      />
    </Say>
  );
  uspBlocks.push(
    <Say key="hourly">
      The beauty of hourly-rate removals is you <b>only pay for the time you use</b> — you can help
      as much or as little as you like to cut time down.
    </Say>
  );
  if (thirdMan)
    uspBlocks.push(
      <Do key="3m" chip={<LeverChip text={`upsell — ${lever(levers, "THIRD_MAN").label}`} />}>
        Offer the third man here: <b>+25% usually pays for itself in time saved</b> on a move this
        size. Frame it as speed, not a surcharge.
      </Do>
    );
  if (vehicleGst)
    uspBlocks.push(
      <Do key="gst" chip={<LeverChip text="vehicle in move" />}>
        Vehicle transport is quoted with <b>different GST treatment</b> to the removal — split them
        clearly when you give the number.
      </Do>
    );

  /* ---------- Close bridge ---------- */
  let bridge;
  if (flexible && mwDates.length > 0)
    bridge = (
      <>
        <Say chip={<LeverChip text={`close — ${flexLever.label}`} />}>
          You've got some flexibility <V value={dateSpeak} fallback="in your window" /> — which
          works in your favour. If we land it on a Tuesday to Thursday — say{" "}
          <V value={mwDates.slice(0, 3).map(fmtShort).join(", ")} fallback="a midweek day" /> — you
          get our <b>Midweek Mover Deal, 5% off</b>
          {quoted ? <> on the <V value={quoted} fallback="$X" /></> : null}. And locking a day now
          means first pick before that week fills. Which of those suits you best?
        </Say>
        <Do>
          Flexible windows are a gift — <b>steer to midweek</b>: better price for them, fills our
          quieter days. Lock <b>one</b> specific date on this call, never leave the window open.
        </Do>
      </>
    );
  else if (flexible)
    bridge = (
      <Say chip={<LeverChip text={`close — ${flexLever.label}`} />}>
        You've got a window there <V value={dateSpeak} fallback="" /> — those days book out fast, so
        let's lock one in now so you get first pick of the crew and start time. Which day suits best?
      </Say>
    );
  else if (scarcity)
    bridge = (
      <>
        <Say chip={<LeverChip text={`close — ${lever(levers, "SCARCITY").label}`} />}>
          {name ? <V value={name} fallback="name" /> : <Var>name</Var>}, I'll be straight with you —{" "}
          <V value={dateNice ? dateNice.split(" ")[0] + "s" : null} fallback="weekend days" /> are
          our biggest days and they <b>book out first</b>. I can hold this slot for you right now
          {quoted ? <> at <V value={quoted} fallback="$X" /></> : null}.
        </Say>
        <Do>
          This scarcity is <b>real</b> — Fri/Sat run at the highest capacity and fill first. Say it
          with confidence because it's true.
        </Do>
      </>
    );
  else if (midweek)
    bridge = (
      <Say chip={<LeverChip text={`close — ${lever(levers, "MIDWEEK").label}`} />}>
        One thing in your favour — because you're moving on a{" "}
        <V value={dateNice ? dateNice.split(" ")[0] : null} fallback="Tue–Thu" />, you qualify for
        our <b>Midweek Mover Deal — 5% off</b>
        {quoted ? <> the <V value={quoted} fallback="$X" /></> : null}. If we lock it in today,
        that's yours.
      </Say>
    );
  else
    bridge = (
      <Say>
        With everything I've explained, does it all make sense — and do you feel comfortable with us
        handling the move{dateNice ? <> on <V value={dateNice} fallback="the date" /></> : null}?
      </Say>
    );

  const discoveryFields = [
    ["Full name", p?.customerName],
    ["Best contact number", p?.phone],
    ["Email for the quote", p?.email],
    ["Pickup address", p?.pickup?.address || p?.pickup?.suburb],
    ["Delivery address", p?.delivery?.address || p?.delivery?.suburb],
    ["Move date", flexible ? `window: ${windowNice} — lock a day` : dateNice],
    ["Any flexibility on dates?", flexible ? `yes — ${p?.moveDateRaw || windowNice}` : null],
    ["Property size / beds", p?.beds ? `${p.beds} bed ${p.propertyType || ""}`.trim() : p?.propertyType],
    ["Volume (m³)", p?.cubicMetres ? `${p.cubicMetres} m³` : null],
    ["Access — stairs / lift / parking", p?.accessNotes],
    ["Special or heavy items", p?.specialItems?.length ? p.specialItems.join(", ") : null],
    ["Packing needed?", null],
  ];

  /* steps now carry LAERC badges */
  const accordions = [
    {
      id: "partner",
      trigger: "I need to speak to my partner",
      steps: [
        { badge: "A+E", content: <>I completely understand wanting to decide as a team. Apart from speaking with your partner — <b>was there anything else holding you back today?</b></> },
        { badge: "C", content: <>With everything I've explained, does it all make sense, and do you feel comfortable with us handling the move?</> },
        { badge: "R", content: <>I'll send a text quote and an email quote now. When do you and your partner think you'll have time to go through it together?</> },
        { badge: "LOCK", content: <>Great — can I give you a quick call on <Var>date</Var> at <Var>time</Var> once you've both looked?</> },
        { badge: "LOCK", content: <><em>Do:</em> put that exact follow-up date &amp; time into all correspondence and CRM tasks.</> },
      ],
    },
    {
      id: "price",
      trigger: "The price is an issue",
      chip: quoted ? <LeverChip text={`pre-loaded — quoted ${quoted}`} /> : null,
      steps: [
        { badge: "L+E", content: <>No worries at all — what budget were you hoping to stay within? <span style={{ color: C.ink2 }}>So we're at {quoted ? <V value={quoted} fallback="$X" /> : <Var>X</Var>} and you were hoping for closer to <Var>Y</Var> — so really we're only talking a difference of <Var>Z</Var> overall. Is that right?</span></> },
        { badge: "E", content: <>We may not be able to go that low, but there are sometimes things we can do. Before I do — <b>if I can get closer to your budget today, are you comfortable moving forward with us?</b></> },
        { badge: "R", content: <>The beauty of hourly-rate removals is you only pay for the time you use — you can help as much or as little as you like to cut time. The rate includes protection, wrapping, experienced movers and fully equipped trucks.</> },
        { badge: "R", content: <>Usually when people get extremely cheap quotes, there's a reason. Often they leave out: <em>wrapping · travel time · fuel · stairs · insurance · GST · depot fees · experienced staff.</em></> },
        { badge: "R", content: <>I can't go that low — but there's a difference in what you pay for and what you receive. With No Limits there are <b>no hidden fees</b>; the focus is a smooth move and your goods arriving safely.</> },
        { badge: "R", content: <>To work within budget we could potentially: <em>reduce packing · move some items yourself · garage drop-off at destination · move off-peak · adjust truck size.</em></> },
        { badge: "R", content: <>I'm going to quickly place you on hold for one minute while I check with my manager on any flexibility — is that okay? <em>(Hold max 1 minute.)</em></> },
        { badge: "LOCK", content: <><em>Do:</em> lock the follow-up — exact date &amp; time into CRM and all correspondence.</> },
      ],
    },
    {
      id: "comp",
      trigger: "I've got a cheaper quote",
      chip: priceDef ? <LeverChip text={`live — ${p?.competitorMention?.detail || "competitor in lead"}`} /> : null,
      steps: [
        { badge: "E", content: <>Where did you get the cheaper quote? Did they include everything we discussed today?</> },
        { badge: "R", content: <>Usually when quotes come in extremely cheap, there's a reason — they often leave out: <em>wrapping · travel time · fuel · stairs · insurance · GST · depot fees · experienced staff.</em></> },
        { badge: "R", content: <>There's a difference in what you pay for and what you receive. With No Limits there are <b>no hidden fees</b> — the focus is a smooth move and your goods arriving safely.</> },
        { badge: "LOCK", content: <><em>Do:</em> if they hold firm, run the budget-flex options, then the manager hold (max 1 minute). Always end with a locked follow-up.</> },
      ],
    },
  ];

  const stages = ["open", "discover", "present", "close", "objections"];
  const stageLabels = { open: "01 Open", discover: "02 Discovery", present: "03 Presentation", close: "04 Close", objections: "⚠ Objections" };

  const scoreDots = (n, max) => (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ width: 10, height: 10, borderRadius: 3, background: i < n ? C.yellow : "#2A3D77" }} />
      ))}
    </span>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT_BODY, color: C.navyDeep }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${C.yellow}; color: ${C.navy}; }
        textarea:focus, input:focus, button:focus-visible, a:focus-visible { outline: 2px solid ${C.yellow}; outline-offset: 2px; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
      `}</style>

      {/* topbar */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: C.navy, color: "#fff", borderBottom: `3px solid ${C.yellow}` }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.02em", textTransform: "uppercase" }}>
              No <span style={{ color: C.yellow }}>Limits</span> Removalists
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", color: "#A9B4CE" }}>Lead → Script</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", color: "#A9B4CE" }}>REP</span>
            <input
              value={rep}
              onChange={(e) => setRep(e.target.value)}
              placeholder="your name"
              style={{ background: "#22376F", border: "1px solid #33487F", color: "#fff", borderRadius: 8, padding: "5px 10px", fontFamily: FONT_MONO, fontSize: "0.75rem", width: 110 }}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: "0 auto", padding: "26px 20px 90px" }}>
        {/* paste panel */}
        <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 18px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", margin: 0, textTransform: "uppercase", color: C.navy }}>
              Paste the lead
            </h1>
            <span style={{ fontFamily: FONT_MONO, fontSize: "0.68rem", color: C.ink2 }}>
              raw email · form dump · SMS · notes — anything
            </span>
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"e.g.\nNew lead from Moving24 — Sarah Nguyen, 0412 345 678\n3 bed house, Blacktown NSW to Newcastle\nPotential move date 20 July - 30 July, she's flexible\nPiano, no lift at pickup\nSays she's got a quote from another mob for $1,600..."}
            rows={7}
            style={{ width: "100%", marginTop: 12, resize: "vertical", background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", fontFamily: FONT_MONO, fontSize: "0.85rem", lineHeight: 1.6, color: C.navyDeep }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={run}
              disabled={loading || !raw.trim() || !rep.trim()}
              style={{
                background: loading || !raw.trim() || !rep.trim() ? "#D8DCE6" : C.yellow,
                color: loading || !raw.trim() || !rep.trim() ? "#8A92A6" : C.navy,
                border: "none", borderRadius: 10, padding: "11px 22px",
                fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "0.9rem",
                letterSpacing: "0.02em", textTransform: "uppercase",
                cursor: loading || !raw.trim() || !rep.trim() ? "not-allowed" : "pointer",
                boxShadow: loading || !raw.trim() || !rep.trim() ? "none" : "0 2px 10px rgba(255,199,44,0.5)",
              }}
            >
              {loading ? "Reading the lead…" : "Build the script"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: "0.68rem", color: C.ink2 }}>QUOTED $</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="optional"
                inputMode="decimal"
                style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: FONT_MONO, fontSize: "0.8rem", width: 100 }}
              />
            </div>
            {loading && (
              <span style={{ fontFamily: FONT_MONO, fontSize: "0.7rem", color: C.ink2, animation: "pulse 1.4s infinite" }}>
                extracting move data → picking levers
              </span>
            )}
            {!rep.trim() && (
              <span style={{ fontFamily: FONT_MONO, fontSize: "0.7rem", color: C.ink2 }}>
                add your name (top right) to start
              </span>
            )}
          </div>
          {error && (
            <div style={{ marginTop: 12, background: C.yellowSoft, border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "10px 14px", fontSize: "0.85rem", color: C.navy }}>
              {error}
            </div>
          )}
        </section>

        {p && (
          <>
            {/* move card */}
            <section id="move-card" style={{ marginTop: 26 }}>
              <StageHead num="◆" title="The Move" sub="what the lead gave us" />
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: C.navy }}>
                    {p.customerName || <span style={{ color: C.ink2, fontStyle: "italic", fontWeight: 400, fontSize: "1rem" }}>name not in lead</span>}
                  </span>
                  {(from || to) && (
                    <span style={{ fontFamily: FONT_MONO, fontSize: "0.8rem", color: C.ink2 }}>
                      {from ? <MapLink href={fromLink}>{from}</MapLink> : "?"}{" "}
                      <span style={{ color: C.yellow, fontWeight: 700 }}>→</span>{" "}
                      {to ? <MapLink href={toLink}>{to}</MapLink> : "?"}
                    </span>
                  )}
                  {routeLink && (
                    <a
                      href={routeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: C.yellow, color: C.navy, borderRadius: 999, padding: "4px 13px", fontFamily: FONT_MONO, fontSize: "0.7rem", fontWeight: 700, textDecoration: "none", textTransform: "uppercase" }}
                    >
                      route in Maps ↗
                    </a>
                  )}
                  {(dateNice || windowNice) && (
                    <span style={{ fontFamily: FONT_MONO, fontSize: "0.75rem", background: C.navy, color: "#fff", borderRadius: 999, padding: "4px 13px" }}>
                      {flexible ? windowNice + " · flexible" : dateNice}
                      {until !== null && until >= 0 && <span style={{ color: C.yellow }}> · {until}d out</span>}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px 20px" }}>
                  <Field label="Phone" value={p.phone} />
                  <Field label="Email" value={p.email} />
                  <Field label="Lead source" value={p.leadSource} />
                  <Field label="Pickup" value={p.pickup?.address || p.pickup?.suburb} link={fromLink} />
                  <Field label="Delivery" value={p.delivery?.address || p.delivery?.suburb} link={toLink} />
                  <Field label="Property" value={p.beds ? `${p.beds} bed ${p.propertyType || ""}`.trim() : p.propertyType} />
                  <Field label="Volume" value={p.cubicMetres ? `${p.cubicMetres} m³` : null} />
                  <Field label="Distance" value={p.distanceCategory === "unknown" ? null : p.distanceCategory.replace("_", " ") + (p.likelyOver140km ? " · 140km+" : "")} />
                  <Field label="Access" value={p.accessNotes} />
                  <Field label="Special items" value={p.specialItems?.length ? p.specialItems.join(", ") : null} />
                  <Field label="Competitor" value={p.competitorMention?.mentioned ? (p.competitorMention.detail || "mentioned") : null} />
                  <Field label="Signals" value={p.customerSignals?.length ? p.customerSignals.join(" · ") : null} />
                </div>
                {p.notes && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line2}`, fontSize: "0.85rem", color: C.ink2 }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Notes · </span>
                    {p.notes}
                  </div>
                )}
              </div>

              {/* lever strip */}
              <div style={{ marginTop: 14, background: C.navy, borderRadius: 14, padding: "16px 18px", color: "#fff" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A9B4CE", marginBottom: 10 }}>
                  Levers fired — this move changed the script {levers.length} way{levers.length === 1 ? "" : "s"}
                </div>
                {levers.length === 0 ? (
                  <div style={{ fontSize: "0.88rem", color: "#C7D0E4" }}>
                    Nothing distinctive fired — the rep gets the standard golden script.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {levers.map((l) => (
                      <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontFamily: FONT_MONO, fontSize: "0.68rem", fontWeight: 700, color: C.yellow, whiteSpace: "nowrap", paddingTop: 2 }}>
                          ▲ {l.label.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "#C7D0E4", lineHeight: 1.5 }}>{l.why}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* mode toggle */}
            <div style={{ display: "flex", gap: 6, marginTop: 26 }}>
              {[["script", "📋 Script"], ["practice", "🎧 Practice call"]].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    background: mode === m ? C.navy : C.surface,
                    color: mode === m ? C.yellow : C.navy,
                    border: `1px solid ${mode === m ? C.navy : C.line}`,
                    borderRadius: 10, padding: "9px 18px",
                    fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "0.85rem",
                    textTransform: "uppercase", letterSpacing: "0.02em", cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "practice" ? (
              /* ------------------- PRACTICE MODE ------------------- */
              <section style={{ marginTop: 16 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.1rem", color: C.navy, textTransform: "uppercase" }}>
                        Sell to {p.customerName || "this customer"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: C.ink2 }}>
                        AI plays the customer off this exact lead. You dial, you speak first. Run the script.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {["easygoing", "standard", "hard"].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          style={{
                            background: difficulty === d ? C.yellow : C.surface,
                            color: C.navy, border: `1px solid ${difficulty === d ? C.yellow : C.line}`,
                            borderRadius: 8, padding: "5px 11px", fontFamily: FONT_MONO,
                            fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* transcript */}
                  <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, minHeight: 180, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {chat.length === 0 && (
                      <div style={{ margin: "auto", textAlign: "center", color: C.ink2, fontFamily: FONT_MONO, fontSize: "0.75rem" }}>
                        ☎ ring ring… they've picked up.<br />Type your opener below — master script says: warm, confirm the enquiry, ask permission.
                      </div>
                    )}
                    {chat.map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: m.role === "rep" ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "78%",
                            background: m.role === "rep" ? C.navy : C.surface,
                            color: m.role === "rep" ? "#fff" : C.navyDeep,
                            border: m.role === "rep" ? "none" : `1px solid ${C.line}`,
                            borderRadius: 12, padding: "9px 13px", fontSize: "0.92rem", lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontFamily: FONT_MONO, fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: m.role === "rep" ? C.yellow : C.ink2, marginBottom: 3 }}>
                            {m.role === "rep" ? (repName || "You") : (p.customerName || "Customer")}
                          </div>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ fontFamily: FONT_MONO, fontSize: "0.72rem", color: C.ink2, animation: "pulse 1.2s infinite" }}>
                        {p.customerName || "customer"} is talking…
                      </div>
                    )}
                  </div>

                  {/* input */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendRepLine();
                        }
                      }}
                      placeholder="Your next line… (Enter to speak)"
                      rows={2}
                      style={{ flex: 1, resize: "none", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontFamily: FONT_BODY, fontSize: "0.92rem" }}
                    />
                    <button
                      onClick={sendRepLine}
                      disabled={chatLoading || !draft.trim()}
                      style={{
                        background: chatLoading || !draft.trim() ? "#D8DCE6" : C.yellow,
                        color: C.navy, border: "none", borderRadius: 10, padding: "0 18px",
                        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "0.85rem",
                        cursor: chatLoading || !draft.trim() ? "not-allowed" : "pointer",
                      }}
                    >
                      Speak
                    </button>
                  </div>

                  {chatError && (
                    <div style={{ marginTop: 10, background: C.yellowSoft, border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "10px 14px", fontSize: "0.85rem", color: C.navy }}>
                      {chatError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={endAndGrade}
                      disabled={chat.length < 2 || grading}
                      style={{
                        background: chat.length < 2 || grading ? "#D8DCE6" : C.navy,
                        color: chat.length < 2 || grading ? "#8A92A6" : C.yellow,
                        border: "none", borderRadius: 10, padding: "10px 18px",
                        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "0.82rem",
                        textTransform: "uppercase", cursor: chat.length < 2 || grading ? "not-allowed" : "pointer",
                      }}
                    >
                      {grading ? "Coach is reviewing…" : "End call & get scored"}
                    </button>
                    <button
                      onClick={resetCall}
                      style={{ background: C.surface, color: C.navy, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 18px", fontFamily: FONT_MONO, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      reset call
                    </button>
                  </div>
                </div>

                {/* debrief */}
                {grade && !grade.error && (
                  <div style={{ marginTop: 14, background: C.navy, borderRadius: 14, padding: 18, color: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                      <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.1rem", textTransform: "uppercase", color: C.yellow }}>
                        Call debrief
                      </span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: "1.4rem", fontWeight: 700 }}>
                        {grade.overall}<span style={{ fontSize: "0.8rem", color: "#A9B4CE" }}>/10</span>
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 9, marginBottom: 16 }}>
                      {(grade.stages || []).map((s) => (
                        <div key={s.stage} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: FONT_MONO, fontSize: "0.68rem", fontWeight: 700, minWidth: 150, paddingTop: 2 }}>{s.stage}</span>
                          {scoreDots(s.score, 5)}
                          <span style={{ fontSize: "0.83rem", color: "#C7D0E4", flex: 1, minWidth: 200 }}>{s.comment}</span>
                        </div>
                      ))}
                    </div>
                    {grade.laerc && (
                      <div style={{ borderTop: "1px solid #2A3D77", paddingTop: 12, marginBottom: 14 }}>
                        <div style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A9B4CE", marginBottom: 8 }}>
                          L·A·E·R·C check
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                          {[["L", "listen"], ["A", "acknowledge"], ["E", "explore"], ["R", "respond"], ["C", "confirm"]].map(([k, key]) => (
                            <span key={k} style={{ fontFamily: FONT_MONO, fontSize: "0.75rem", fontWeight: 700, color: grade.laerc[key] ? C.yellow : "#5A6B9E" }}>
                              {grade.laerc[key] ? "✓" : "✗"} {LAERC_INFO[k][0]}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: "0.83rem", color: "#C7D0E4" }}>{grade.laerc.comment}</div>
                      </div>
                    )}
                    {grade.bestMoment && (
                      <div style={{ background: C.yellow, color: C.navy, borderRadius: 10, padding: "10px 14px", fontSize: "0.88rem", fontWeight: 600, marginBottom: 12 }}>
                        ★ Best moment: {grade.bestMoment}
                      </div>
                    )}
                    {grade.fixes?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A9B4CE", marginBottom: 6 }}>
                          Fix next call
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                          {grade.fixes.map((f, i) => (
                            <li key={i} style={{ fontSize: "0.88rem", color: "#E6EAF5", lineHeight: 1.5 }}>{f}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
                {grade?.error && (
                  <div style={{ marginTop: 14, background: C.yellowSoft, border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "10px 14px", fontSize: "0.85rem", color: C.navy }}>
                    Scoring hiccup — hit "End call & get scored" again.
                  </div>
                )}
              </section>
            ) : (
              /* -------------------- SCRIPT MODE -------------------- */
              <>
                <nav
                  style={{
                    position: "sticky", top: 58, zIndex: 30, marginTop: 16,
                    background: C.bg, borderBottom: `1px solid ${C.line}`,
                    display: "flex", gap: 6, overflowX: "auto", padding: "8px 0",
                  }}
                >
                  {stages.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        const el = document.getElementById("stage-" + s);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 13px", fontFamily: FONT_MONO, fontSize: "0.72rem", fontWeight: 700, color: C.navy, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {stageLabels[s]}
                    </button>
                  ))}
                </nav>

                <p style={{ margin: "16px 2px 0", fontSize: "0.85rem", color: C.ink2 }}>
                  Run the call A→B. Hit the main points — don't read robot-style. <b style={{ color: C.navy }}>Speak the yellow, do the navy.</b>
                </p>

                {/* 01 OPEN */}
                <section id="stage-open" style={{ scrollMarginTop: 120 }}>
                  <StageHead num="01" title="The Open" sub={urgent ? "compressed — under a week out" : "first 20 seconds"} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[["outbound", "📞 Outbound — they enquired"], ["inbound", "📥 Inbound — they called us"]].map(([t, label]) => (
                      <button
                        key={t}
                        onClick={() => setCallType(t)}
                        style={{
                          background: callType === t ? C.navy : C.surface,
                          color: callType === t ? "#fff" : C.navy,
                          border: `1px solid ${callType === t ? C.navy : C.line}`,
                          borderRadius: 8, padding: "6px 14px",
                          fontFamily: FONT_MONO, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {urgent && (
                    <Do chip={<LeverChip text={`compressed — ${lever(levers, "URGENT").label}`} />}>
                      Skip the rapport padding. This customer needs a truck in {until} day{until === 1 ? "" : "s"} —
                      get to availability and lock-in <b>fast</b>. Every hour they wait, a competitor calls.
                    </Do>
                  )}
                  {callType === "outbound" ? (
                    <Say>
                      Hi <V value={name} fallback="name" />, hope you're well? This is{" "}
                      <V value={repName} fallback="rep" /> from No Limits. You just submitted an
                      enquiry with us about moving from <V value={from} fallback="A" /> to{" "}
                      <V value={to} fallback="B" />?
                    </Say>
                  ) : (
                    <Say>
                      Hi, this is <V value={repName} fallback="rep" /> from No Limits — how can I help you?
                    </Say>
                  )}
                  <Say>
                    Thank you — let's see if we can help you. I've just got a few quick questions to
                    get some details, and from there I'll be able to organise everything you need. Is
                    that okay with you?
                  </Say>
                  {trustOpen && (
                    <Say chip={<LeverChip text={`promoted — ${lever(levers, "TRUST_OPEN").label}`} />}>
                      And just so you know from the start — you're in safe hands. We're fully insured
                      with over <b>5,000 five-star reviews</b>, so we'll make this easy for you.
                    </Say>
                  )}
                  <Do>
                    Land an early <b>yes</b>. Warm, easy, in control — you're organising their move,
                    not selling them.
                  </Do>
                  <Do>
                    {routeLink ? (
                      <>
                        <a href={routeLink} target="_blank" rel="noopener noreferrer" style={{ color: C.navy, fontWeight: 700, textDecorationColor: C.yellow, textDecorationThickness: 2 }}>
                          Open the route in Maps ↗
                        </a>{" "}
                        while you're talking — know {from} → {to} before they finish their first sentence.
                      </>
                    ) : (
                      <>Pull the route up on Google Maps while you're talking — know it before they finish their first sentence.</>
                    )}
                  </Do>
                </section>

                {/* 02 DISCOVERY */}
                <section id="stage-discover" style={{ scrollMarginTop: 120 }}>
                  <StageHead num="02" title="Discovery" sub="listen → confirm → build trust" />
                  <Say>
                    Great — so you're moving from <V value={from} fallback="A" /> to <V value={to} fallback="B" />
                    {dateSpeak ? <>, <V value={dateSpeak} fallback="" /></> : null}.
                  </Say>
                  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "8px 18px" }}>
                    {discoveryFields.map(([label, val], i) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < discoveryFields.length - 1 ? `1px solid ${C.line2}` : "none", flexWrap: "wrap" }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: val ? C.navy : "transparent", border: val ? "none" : `2px solid ${C.line}`, color: C.yellow, fontSize: "0.75rem", fontWeight: 700 }}>
                          {val ? "✓" : ""}
                        </span>
                        <span style={{ fontSize: "0.92rem", fontWeight: 600, minWidth: 190, color: C.navyDeep }}>{label}</span>
                        <span style={{ fontSize: "0.88rem", color: val ? C.navyDeep : C.ink2, fontFamily: val ? FONT_BODY : FONT_MONO, fontStyle: val ? "normal" : "italic" }}>
                          {val ? (
                            <>
                              <span style={{ color: C.navy, fontFamily: FONT_MONO, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", background: C.yellowSoft, borderRadius: 4, padding: "1px 6px", marginRight: 6 }}>confirm</span>
                              {val}
                            </>
                          ) : (
                            "ask"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Do>
                      Ticked items came from the lead — <b>confirm them, don't re-ask</b>. "Just
                      confirming it's a {p.beds ? `${p.beds} bed` : "…"} at {from || "…"} — that
                      right?" sounds like you did your homework. After the key questions,{" "}
                      <b>go quiet 5–10 seconds</b> — let them talk.
                    </Do>
                  </div>
                </section>

                {/* 03 PRESENTATION */}
                <section id="stage-present" style={{ scrollMarginTop: 120 }}>
                  <StageHead num="03" title="Presentation" sub="USPs re-ordered for this move" />
                  {uspBlocks}
                </section>

                {/* 04 CLOSE */}
                <section id="stage-close" style={{ scrollMarginTop: 120 }}>
                  <StageHead num="04" title="Close" sub="secure the truck & crew" />
                  {bridge}
                  <Say>
                    The next step to get everything locked in is the <b>$200 booking fee</b> — which
                    simply comes off your final balance on the day.
                  </Say>
                  <Say>
                    What I'll do now is send you a secure payment link by text so we can reserve the
                    truck and crew for your move.
                  </Say>
                  <Say>I've just sent that through — did you receive the text?</Say>
                  <Do>
                    Get the <b>yes</b>.
                  </Do>
                  <Say>
                    Perfect — if you open that now, I'll stay on the line while we get everything
                    confirmed and secured for your moving date.
                  </Say>
                  <Do>
                    <b>Stay quiet.</b> Let them process the payment. Do not overtalk.
                  </Do>
                  <Say sub="once paid">
                    Perfect, thank you — you're now officially booked in and locked away with No
                    Limits Removals.
                  </Say>
                  <Do>
                    If it's not a booking — the call <b>never ends without a locked next step</b>: an
                    exact follow-up date &amp; time in the CRM and every message you send.
                  </Do>
                </section>

                {/* OBJECTIONS */}
                <section id="stage-objections" style={{ scrollMarginTop: 120 }}>
                  <StageHead num="⚠" title="Objections" sub="the pattern, then the lines" />

                  {/* psychology / mindset strip */}
                  <div style={{ background: C.navy, borderRadius: 14, padding: "15px 18px", color: "#fff", marginBottom: 12 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A9B4CE", marginBottom: 9 }}>
                      Mindset — read once before every shift
                    </div>
                    <div style={{ display: "grid", gap: 7, fontSize: "0.86rem", color: "#E6EAF5", lineHeight: 1.5 }}>
                      <div>▲ <b style={{ color: C.yellow }}>An objection is engagement.</b> A customer pushing back is still deciding — indifference is what kills deals, not questions.</div>
                      <div>▲ <b style={{ color: C.yellow }}>Never argue.</b> Defending hardens them. Let them finish completely, acknowledge first — nobody hears your answer until they feel heard.</div>
                      <div>▲ <b style={{ color: C.yellow }}>The first objection is often a smokescreen.</b> "Too expensive" can really mean "nervous about damage" or "need my partner". Explore before you respond — resolve the real one.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                      {["L", "A", "E", "R", "C"].map((k) => (
                        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <LaercBadge code={k} />
                          <span style={{ fontSize: "0.75rem", color: "#C7D0E4" }}>
                            <b style={{ color: "#fff" }}>{LAERC_INFO[k][0]}</b> — {LAERC_INFO[k][1]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {accordions.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: C.surface,
                        border: `1px solid ${a.id === "comp" && priceDef ? C.yellow : C.line}`,
                        borderRadius: 12, marginBottom: 10, overflow: "hidden",
                        boxShadow: a.id === "comp" && priceDef ? "0 0 0 2px " + C.yellowSoft : "none",
                      }}
                    >
                      <button
                        onClick={() => setOpenAcc(openAcc === a.id ? null : a.id)}
                        aria-expanded={openAcc === a.id}
                        style={{ width: "100%", background: "transparent", border: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}
                      >
                        <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "1.3rem", color: C.yellow, lineHeight: 1 }}>"</span>
                        <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: "1rem", flex: 1, color: C.navy }}>{a.trigger}</span>
                        {a.chip}
                        <span style={{ fontSize: "1.2rem", color: C.ink2, transform: openAcc === a.id ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
                      </button>
                      {openAcc === a.id && (
                        <div style={{ padding: "0 18px 16px", display: "grid", gap: 10 }}>
                          {a.steps.map((s, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <LaercBadge code={s.badge} />
                              <div style={{ fontSize: "0.95rem", lineHeight: 1.6, color: C.navyDeep, flex: 1 }}>{s.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Feel-Felt-Found */}
                  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: "0.95rem", color: C.navy, textTransform: "uppercase", marginBottom: 8 }}>
                      Universal tool — Feel · Felt · Found
                    </div>
                    <div style={{ fontSize: "0.85rem", color: C.ink2, marginBottom: 10 }}>
                      For any objection that isn't on a card — validate their emotion, normalise it
                      with other customers, land the resolution with proof.
                    </div>
                    <Say>
                      I understand how you <b>feel</b> — a lot of our customers <b>felt</b> exactly
                      the same at first. What they <b>found</b> was the move cost what we quoted,
                      nothing bolted on, and their goods arrived safe — that's how you end up with
                      over 5,000 five-star reviews.
                    </Say>
                    <Do>
                      Then <b>confirm</b> it's cleared — "does that put your mind at ease?" — before
                      you go back to the close. Never build on an objection that's still alive.
                    </Do>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {!p && !loading && (
          <div style={{ marginTop: 30, textAlign: "center", color: C.ink2, fontFamily: FONT_MONO, fontSize: "0.78rem" }}>
            paste a lead above — the move data picks the script, then hit Practice to sell it
          </div>
        )}
      </main>
    </div>
  );
}
