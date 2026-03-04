import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildFitScorePrompt, stripCodeFences } from "@/lib/prompts";
import { FREE_FIT_LIMIT, MODELS } from "@/lib/constants";
import type { FitScoreResult } from "@/lib/types";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Check auth + plan for free limit enforcement
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentFitCount = 0;
  let isPro = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, fit_count")
      .eq("id", user.id)
      .single();

    isPro = profile?.plan === "pro";
    currentFitCount = profile?.fit_count ?? 0;

    if (!isPro && currentFitCount >= FREE_FIT_LIMIT) {
      return NextResponse.json({ error: "fit_limit_reached" }, { status: 429 });
    }
  }

  let body: { resume_text: string; jd_text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resume_text, jd_text } = body;

  if (!resume_text || typeof resume_text !== "string") {
    return NextResponse.json({ error: "resume_text is required" }, { status: 400 });
  }
  if (!jd_text || typeof jd_text !== "string") {
    return NextResponse.json({ error: "jd_text is required" }, { status: 400 });
  }

  const trimmedResume = resume_text.trim();
  const trimmedJd = jd_text.trim();

  if (trimmedResume.length < 100) {
    return NextResponse.json(
      { error: "Resume is too short — paste the full text of your resume." },
      { status: 400 }
    );
  }
  if (trimmedResume.length > 20_000) {
    return NextResponse.json(
      { error: "Resume text too long (max 20,000 characters)." },
      { status: 400 }
    );
  }
  if (trimmedJd.length < 50) {
    return NextResponse.json(
      { error: "Job description is too short — paste the full job posting." },
      { status: 400 }
    );
  }
  if (trimmedJd.length > 15_000) {
    return NextResponse.json(
      { error: "Job description too long (max 15,000 characters)." },
      { status: 400 }
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.parser,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildFitScorePrompt(trimmedResume, trimmedJd) }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let result: FitScoreResult;
    try {
      result = JSON.parse(stripCodeFences(raw)) as FitScoreResult;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse fit score — please try again." },
        { status: 500 }
      );
    }

    // Increment fit_count for authenticated users — fire-and-forget
    if (user) {
      void supabase
        .from("profiles")
        .update({ fit_count: currentFitCount + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fit scoring failed";
    console.error("[shortlist] fit score error:", message);
    return NextResponse.json({ error: "Fit scoring failed — please try again." }, { status: 500 });
  }
}
