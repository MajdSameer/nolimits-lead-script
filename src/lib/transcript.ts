/* ------------------------------------------------------------------ */
/*  Shared transcript helpers for the practice routes. The client sends */
/*  a raw list of turns; the server owns turning it into prompt text.   */
/* ------------------------------------------------------------------ */

export type Turn = { role: "rep" | "customer"; text: string };

export const MAX_TURNS = 40;
export const MAX_PRACTICE_LINE = 1000;

/** Coerce untrusted client input into a clean list of turns. */
export function normalizeTurns(input: unknown): Turn[] {
  if (!Array.isArray(input)) return [];
  const out: Turn[] = [];
  for (const m of input) {
    const role = m?.role === "rep" ? "rep" : m?.role === "customer" ? "customer" : null;
    const text = typeof m?.text === "string" ? m.text : "";
    if (role && text) out.push({ role, text });
  }
  return out;
}

export function transcriptText(turns: Turn[]): string {
  return turns
    .map((m) => (m.role === "rep" ? "REP: " : "CUSTOMER: ") + m.text)
    .join("\n");
}
