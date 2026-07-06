/* ------------------------------------------------------------------ */
/*  Server-side model caller — Google Gemini (free tier).              */
/*  The API key lives ONLY here, read from process.env at request      */
/*  time; it never reaches the client. Swapping providers touches only */
/*  this file — the prompts and UI are provider-agnostic.              */
/* ------------------------------------------------------------------ */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type CallOpts = {
  /** Force strict JSON output (parse & grade). */
  json?: boolean;
  /** Sampling temperature; lower = more deterministic. */
  temperature?: number;
};

/**
 * Send a single user-turn prompt to Gemini and return the joined text.
 * Throws on missing key or a non-OK response so the route can map it to a
 * clean JSON error for the client's yellow error card.
 */
export async function callModel(
  prompt: string,
  model: string,
  opts: CallOpts = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing GEMINI_API_KEY.");
  }

  const generationConfig: Record<string, any> = {
    maxOutputTokens: 1000,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  // 2.5 models "think" by default, which eats the output budget — turn it off.
  if (model.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    // Never surface the raw upstream body (could echo request internals).
    throw new Error(`Gemini request failed (${res.status}).`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => (p && p.text) || "").join("");
}

/** Strip markdown fences the model sometimes wraps JSON in, then parse. */
export function parseModelJson<T = any>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
