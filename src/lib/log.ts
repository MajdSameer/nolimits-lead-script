/* ------------------------------------------------------------------ */
/*  Fire-and-forget logging → Apps Script Web App → Google Sheets.      */
/*  A logging failure must NEVER break the rep's flow, so every call    */
/*  here swallows errors. If LOG_WEBAPP_URL is unset, logging is a      */
/*  silent no-op and the app works fully.                               */
/*                                                                      */
/*  Do NOT log full lead text, phone numbers, emails, street            */
/*  addresses, or transcripts — only the whitelisted fields below.      */
/* ------------------------------------------------------------------ */

export type ScriptGeneratedEvent = {
  type: "script_generated";
  rep: string;
  customerFirstName: string | null;
  routeFrom: string | null; // suburb only
  routeTo: string | null; // suburb only
  distanceCategory: string | null;
  levers: string; // comma-joined lever IDs
  flexibleWindow: boolean;
  quotedPrice: number | null;
};

export type PracticeScoredEvent = {
  type: "practice_scored";
  rep: string;
  difficulty: string;
  overall: number | null;
  stageScores: number[]; // five stage scores
  laerc: boolean[]; // five LAERC booleans
  turns: number;
};

export type LogEvent = ScriptGeneratedEvent | PracticeScoredEvent;

export async function sendLog(event: LogEvent): Promise<void> {
  const url = process.env.LOG_WEBAPP_URL;
  const secret = process.env.LOG_SHARED_SECRET;
  if (!url || !secret) return; // logging disabled — not an error

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, ...event }),
      // Don't let a slow/hanging endpoint stall the request handler.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Swallow — logging must never surface to the rep.
  }
}
