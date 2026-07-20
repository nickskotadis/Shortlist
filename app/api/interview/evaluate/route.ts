import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildAnswerCoachPrompt } from "@/lib/prompts";
import { parseLlmJson } from "@/lib/llm-json";
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

  const { user_answer, resume_text, jd_text } = body;
  // BUG-11: truncate question and framework to prevent token burning
  const question = typeof body.question === "string" ? body.question.slice(0, 500) : body.question;
  const framework = typeof body.framework === "string" ? body.framework.slice(0, 1000) : body.framework;

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
    const parsed = await parseLlmJson<AnswerCoachResult>(async () => {
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
      return response.content[0]?.type === "text" ? response.content[0].text : "";
    });

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Couldn't read the evaluation — please try again." },
        { status: 500 }
      );
    }
    const result = parsed.value;

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed";
    console.error("[shortlist] answer coach error:", message);
    return NextResponse.json({ error: "Evaluation failed — please try again." }, { status: 500 });
  }
}
