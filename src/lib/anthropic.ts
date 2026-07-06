/* ------------------------------------------------------------------ */
/*  Server-side Anthropic caller. The API key lives ONLY here, read    */
/*  from process.env at request time — it never reaches the client.    */
/* ------------------------------------------------------------------ */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type ClaudeModel =
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

/**
 * Send a single user-turn prompt to Anthropic and return the joined text.
 * Throws on missing key or a non-OK response so the route can map it to a
 * clean JSON error for the client's yellow error card.
 */
export async function callClaude(
  prompt: string,
  model: ClaudeModel
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing ANTHROPIC_API_KEY.");
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    // Never surface the raw upstream body (could echo request internals).
    throw new Error(`Anthropic request failed (${res.status}).`);
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

/** Strip markdown fences the model sometimes wraps JSON in, then parse. */
export function parseModelJson<T = any>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
