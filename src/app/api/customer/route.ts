import { NextResponse, type NextRequest } from "next/server";
import { guard, jsonError, requireRep } from "@/lib/guard";
import { personaPrompt } from "@/lib/prompts";
import { callModel } from "@/lib/model";
import {
  MAX_PRACTICE_LINE,
  MAX_TURNS,
  normalizeTurns,
  transcriptText,
} from "@/lib/transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return jsonError("Enter your rep name before practising.", 400);
  }

  const p = body?.lead;
  if (!p || typeof p !== "object") {
    return jsonError("Build a script from a lead before practising.", 400);
  }

  const difficulty =
    body?.difficulty === "easygoing" ||
    body?.difficulty === "hard" ||
    body?.difficulty === "standard"
      ? body.difficulty
      : "standard";

  const turns = normalizeTurns(body?.messages);

  // Newest rep line must be a single spoken line, not a pasted essay.
  const lastRep = [...turns].reverse().find((t) => t.role === "rep");
  if (lastRep && lastRep.text.length > MAX_PRACTICE_LINE) {
    return jsonError(
      "That line's too long — keep it to what you'd actually say out loud.",
      413
    );
  }

  // Cap the call length; beyond this, steer them to get scored.
  if (turns.length > MAX_TURNS) {
    return NextResponse.json({
      limit: true,
      message: "That's a full call — end it and get scored to see how you did.",
    });
  }

  try {
    const reply = await callModel(
      personaPrompt(p, difficulty, transcriptText(turns)),
      "gemini-2.0-flash",
      { temperature: 0.9 }
    );
    return NextResponse.json({ reply: reply.trim() });
  } catch {
    return jsonError("Line dropped — try sending that again.", 502);
  }
}
