import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildInterviewPrepPrompt, stripCodeFences } from "@/lib/prompts";
import { MODELS, INTERVIEW_IP_LIMIT, INTERVIEW_IP_WINDOW_SEC } from "@/lib/constants";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { InterviewPrepResult } from "@/lib/types";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // This route has no auth by design (free interview prep). Bound it per IP so
  // the 4096-token Haiku call can't be scripted into unbounded spend.
  const ip = getClientIp(req);
  const { allowed, retryAfterSec } = await rateLimit(
    `interview:${ip}`,
    INTERVIEW_IP_LIMIT,
    INTERVIEW_IP_WINDOW_SEC
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a bit before generating more interview questions." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let body: { jd_text?: string; resume_text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jd_text, resume_text } = body;

  if (!resume_text || typeof resume_text !== "string") {
    return NextResponse.json({ error: "resume_text is required" }, { status: 400 });
  }

  const trimmedResume = resume_text.trim();
  if (trimmedResume.length < 50) {
    return NextResponse.json(
      { error: "Resume is too short — paste more of your background so we can tailor the questions." },
      { status: 400 }
    );
  }
  if (trimmedResume.length > 8_000) {
    return NextResponse.json(
      { error: "Resume text too long (max 8,000 characters)." },
      { status: 400 }
    );
  }

  if (jd_text !== undefined && jd_text !== null) {
    if (typeof jd_text !== "string") {
      return NextResponse.json({ error: "jd_text must be a string" }, { status: 400 });
    }
    if (jd_text.trim().length > 15_000) {
      return NextResponse.json(
        { error: "Job description too long (max 15,000 characters)." },
        { status: 400 }
      );
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.parser,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildInterviewPrepPrompt(jd_text ?? "", trimmedResume) }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let result: InterviewPrepResult;
    try {
      result = JSON.parse(stripCodeFences(raw)) as InterviewPrepResult;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse interview prep result — please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interview prep failed";
    console.error("[shortlist] interview prep error:", message);
    return NextResponse.json({ error: "Interview prep failed — please try again." }, { status: 500 });
  }
}
