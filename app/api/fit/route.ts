import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildFitScorePrompt, stripCodeFences } from "@/lib/prompts";
import { FREE_FIT_LIMIT, MODELS } from "@/lib/constants";
import type { FitScoreResult } from "@/lib/types";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Require authentication — limit is per-account, meaningless without an identity
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // BUG-08: parse and validate body before consuming the free usage slot
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, fit_count")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro";
  const currentFitCount = profile?.fit_count ?? 0;

  // Free users: atomically claim the slot before the LLM call.
  // The UPDATE only succeeds if fit_count hasn't changed since we read it,
  // which prevents concurrent requests from both passing the limit check.
  if (!isPro) {
    if (currentFitCount >= FREE_FIT_LIMIT) {
      return NextResponse.json({ error: "fit_limit_reached" }, { status: 429 });
    }

    const { data: claimed } = await supabase
      .from("profiles")
      .update({ fit_count: currentFitCount + 1 })
      .eq("id", user.id)
      .eq("fit_count", currentFitCount) // optimistic lock
      .select("id")
      .maybeSingle();

    if (!claimed) {
      // Another concurrent request already incremented — treat as limit reached
      return NextResponse.json({ error: "fit_limit_reached" }, { status: 429 });
    }
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

    // Pro users: increment count after success (no limit enforcement needed)
    if (isPro) {
      void supabase
        .from("profiles")
        .update({ fit_count: currentFitCount + 1 })
        .eq("id", user.id);
    }
    // Free users: count was already incremented atomically above

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fit scoring failed";
    console.error("[shortlist] fit score error:", message);
    return NextResponse.json({ error: "Fit scoring failed — please try again." }, { status: 500 });
  }
}
