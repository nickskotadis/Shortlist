import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildAnswerCoachPrompt, stripCodeFences } from "@/lib/prompts";
import { MODELS } from "@/lib/constants";
import type { AnswerCoachResult } from "@/lib/types";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Plan check — Pro only
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!profile || profile.plan !== "pro") {
    return NextResponse.json(
      { error: "Answer Coach is a Pro feature. Upgrade to access it." },
      { status: 403 }
    );
  }

  // Parse body
  let body: {
    question: string;
    user_answer: string;
    framework: string;
    resume_text?: string;
    jd_text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, user_answer, framework, resume_text, jd_text } = body;

  // Validate required fields
  if (!question || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (!user_answer || typeof user_answer !== "string") {
    return NextResponse.json({ error: "user_answer is required" }, { status: 400 });
  }

  const trimmedAnswer = user_answer.trim();
  if (trimmedAnswer.length < 10) {
    return NextResponse.json(
      { error: "Answer is too short — write at least a sentence so we can give useful feedback." },
      { status: 400 }
    );
  }
  if (trimmedAnswer.length > 3_000) {
    return NextResponse.json(
      { error: "Answer is too long (max 3,000 characters)." },
      { status: 400 }
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.parser,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: buildAnswerCoachPrompt(
            question,
            trimmedAnswer,
            framework ?? "",
            resume_text,
            jd_text
          ),
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let result: AnswerCoachResult;
    try {
      result = JSON.parse(stripCodeFences(raw)) as AnswerCoachResult;
    } catch {
      return NextResponse.json(
        { error: "Failed to evaluate answer — please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed";
    console.error("[shortlist] answer coach error:", message);
    return NextResponse.json({ error: "Evaluation failed — please try again." }, { status: 500 });
  }
}
