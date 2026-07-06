/* ------------------------------------------------------------------ */
/*  Access control (v1): a single shared team passcode. On success we   */
/*  set an httpOnly session cookie whose value is an HMAC the client    */
/*  cannot forge (the key is TEAM_PASSCODE, which is server-only).      */
/*  This is deliberately NOT real auth — it just stops the open         */
/*  internet from burning the API key.                                  */
/* ------------------------------------------------------------------ */

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "nl_session";
const SESSION_MESSAGE = "nolimits-lead-script:v1";

function passcode(): string {
  return process.env.TEAM_PASSCODE || "";
}

/** Deterministic token derived from the server-only passcode. */
export function sessionToken(): string {
  return createHmac("sha256", passcode()).update(SESSION_MESSAGE).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Constant-time check of a rep-supplied passcode against the env value. */
export function checkPasscode(supplied: string): boolean {
  const expected = passcode();
  if (!expected) return false; // never allow entry if unconfigured
  return safeEqual(supplied, expected);
}

/** True when the request carries a valid session cookie. */
export function hasValidSession(req: NextRequest): boolean {
  if (!passcode()) return false;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, sessionToken());
}
