import { NextResponse, type NextRequest } from "next/server";
import { guard, jsonError, requireRep } from "@/lib/guard";
import { sendLog, type LogEvent } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Coerce anything to a plain suburb-or-null string (never an address). */
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;

const bool = (v: unknown): boolean => v === true;

/**
 * Build a whitelisted event from untrusted client input. This is the last
 * line of defence against PII sneaking into the sheet — we only ever copy
 * the fields the spec permits, nothing else from the body.
 */
function buildEvent(body: any, rep: string): LogEvent | null {
  if (body?.type === "script_generated") {
    return {
      type: "script_generated",
      rep,
      customerFirstName: str(body.customerFirstName),
      routeFrom: str(body.routeFrom),
      routeTo: str(body.routeTo),
      distanceCategory: str(body.distanceCategory),
      levers: str(body.levers) || "",
      flexibleWindow: bool(body.flexibleWindow),
      quotedPrice: num(body.quotedPrice),
    };
  }
  if (body?.type === "practice_scored") {
    const stageScores = Array.isArray(body.stageScores)
      ? body.stageScores.map(num).map((n: number | null) => n ?? 0).slice(0, 5)
      : [];
    const laerc = Array.isArray(body.laerc)
      ? body.laerc.map(bool).slice(0, 5)
      : [];
    return {
      type: "practice_scored",
      rep,
      difficulty: str(body.difficulty) || "standard",
      overall: num(body.overall),
      stageScores,
      laerc,
      turns: num(body.turns) ?? 0,
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Bad request.", 400);
  }

  const rep = requireRep(body?.rep);
  if (!rep) {
    // Logging shouldn't hard-fail the rep, but a missing rep means a
    // useless row — just no-op quietly.
    return NextResponse.json({ ok: true });
  }

  const event = buildEvent(body, rep);
  if (!event) {
    return jsonError("Unknown log event.", 400);
  }

  // Server-side fire-and-forget to Apps Script; sendLog swallows failures.
  await sendLog(event);
  return NextResponse.json({ ok: true });
}
