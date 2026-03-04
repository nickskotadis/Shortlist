import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildHealthScorePrompt, stripCodeFences } from "@/lib/prompts";
import { MODELS } from "@/lib/constants";
import type { HealthScoreResult } from "@/lib/types";

export const maxDuration = 30;

export const FREE_SCORE_LIMIT = 1;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Check auth + plan for free limit enforcement
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentScoreCount = 0;
  let isPro = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, score_count")
      .eq("id", user.id)
      .single();

    isPro = profile?.plan === "pro";
    currentScoreCount = profile?.score_count ?? 0;

    if (!isPro && currentScoreCount >= FREE_SCORE_LIMIT) {
      return NextResponse.json({ error: "score_limit_reached" }, { status: 429 });
    }
  }

  let body: { resume_text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resume_text } = body;

  if (!resume_text || typeof resume_text !== "string") {
    return NextResponse.json({ error: "resume_text is required" }, { status: 400 });
  }

  const trimmed = resume_text.trim();
  if (trimmed.length < 100) {
    return NextResponse.json(
      { error: "Resume is too short — paste the full text of your resume." },
      { status: 400 }
    );
  }
  if (trimmed.length > 20_000) {
    return NextResponse.json(
      { error: "Resume text too long (max 20,000 characters)." },
      { status: 400 }
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.parser,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildHealthScorePrompt(trimmed) }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let result: HealthScoreResult;
    try {
      result = JSON.parse(stripCodeFences(raw)) as HealthScoreResult;
    } catch {
      return NextResponse.json({ error: "Failed to parse score result — please try again." }, { status: 500 });
    }

    // Increment score_count for authenticated users — fire-and-forget
    if (user) {
      void supabase
        .from("profiles")
        .update({ score_count: currentScoreCount + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    console.error("[shortlist] score error:", message);
    return NextResponse.json({ error: "Scoring failed — please try again." }, { status: 500 });
  }
}
