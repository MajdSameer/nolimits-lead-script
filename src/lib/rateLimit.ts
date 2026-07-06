/* ------------------------------------------------------------------ */
/*  Per-IP rate limit: 30 requests/minute is plenty for a human on a    */
/*  call. In-memory sliding window — best-effort per serverless         */
/*  instance, which is enough to blunt runaway/abusive traffic for v1.  */
/* ------------------------------------------------------------------ */

import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Returns true if the caller is over the limit and should be rejected. */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) || []).filter((t) => t > cutoff);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
  }

  return recent.length > MAX_REQUESTS;
}
