import { NextResponse, type NextRequest } from "next/server";
import { guard, jsonError, requireRep } from "@/lib/guard";
import { gradePrompt } from "@/lib/prompts";
import { callModel, parseModelJson } from "@/lib/model";
import { normalizeTurns, transcriptText } from "@/lib/transcript";

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

  const turns = normalizeTurns(body?.messages);
  if (turns.length < 2) {
    return jsonError("Have a proper go first, then get scored.", 400);
  }

  try {
    const text = await callModel(
      gradePrompt(p, transcriptText(turns)),
      "gemini-2.5-flash",
      { json: true, temperature: 0.3 }
    );
    const grade = parseModelJson(text);
    return NextResponse.json({ grade });
  } catch {
    return jsonError("Scoring hiccup — hit \"End call & get scored\" again.", 502);
  }
}
