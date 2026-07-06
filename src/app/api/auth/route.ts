import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  checkPasscode,
  hasValidSession,
  sessionToken,
} from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — cheap check the client uses on load to decide gate vs app. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: hasValidSession(req) });
}

/** POST — exchange the team passcode for an httpOnly session cookie. */
export async function POST(req: NextRequest) {
  // Rate-limit the gate too, so it can't be brute-forced.
  if (isRateLimited(clientIp(req))) {
    return jsonError("Too many attempts — wait a moment.", 429);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Bad request.", 400);
  }

  const supplied = typeof body?.passcode === "string" ? body.passcode : "";
  if (!checkPasscode(supplied)) {
    return jsonError("That passcode didn't work.", 401);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h working day
  });
  return res;
}
