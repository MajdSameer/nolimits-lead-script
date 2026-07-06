/* ------------------------------------------------------------------ */
/*  Shared route guard: every API route rejects requests without a      */
/*  valid session and enforces the per-IP rate limit before doing any   */
/*  work (or spending a token).                                         */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "./auth";
import { clientIp, isRateLimited } from "./rateLimit";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Returns a NextResponse to short-circuit with, or null to proceed.
 * Order: session first (cheapest rejection), then rate limit.
 */
export function guard(req: NextRequest): NextResponse | null {
  if (!hasValidSession(req)) {
    return jsonError("Session expired — enter the team passcode again.", 401);
  }
  if (isRateLimited(clientIp(req))) {
    return jsonError("Slow down a moment and try again.", 429);
  }
  return null;
}

/** Require a non-empty rep name — it feeds the log and is mandatory. */
export function requireRep(rep: unknown): string | null {
  if (typeof rep !== "string") return null;
  const trimmed = rep.trim();
  return trimmed.length > 0 ? trimmed : null;
}
