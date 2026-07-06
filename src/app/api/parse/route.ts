import { NextResponse, type NextRequest } from "next/server";
import { guard, jsonError, requireRep } from "@/lib/guard";
import { parsePrompt } from "@/lib/prompts";
import { callClaude, parseModelJson } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEAD_CHARS = 4000;

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
    return jsonError("Enter your rep name before building a script.", 400);
  }

  const rawText = typeof body?.rawText === "string" ? body.rawText : "";
  if (!rawText.trim()) {
    return jsonError("Paste a lead first.", 400);
  }
  if (rawText.length > MAX_LEAD_CHARS) {
    return jsonError(
      `That lead is too long (max ${MAX_LEAD_CHARS.toLocaleString()} characters).`,
      413
    );
  }

  try {
    const text = await callClaude(parsePrompt(rawText), "claude-sonnet-4-6");
    const parsed = parseModelJson(text);
    return NextResponse.json({ parsed });
  } catch {
    return jsonError(
      "Couldn't parse that lead. Check the pasted text and try again.",
      502
    );
  }
}
