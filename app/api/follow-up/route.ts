import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELS } from "@/lib/constants";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_FIELD_LEN = 200;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.company_name || !body?.job_title) {
    return NextResponse.json({ error: "company_name and job_title are required" }, { status: 400 });
  }

  // Enforce max lengths to prevent prompt stuffing
  const company_name = String(body.company_name).slice(0, MAX_FIELD_LEN);
  const job_title = String(body.job_title).slice(0, MAX_FIELD_LEN);
  const candidate_name = body.candidate_name ? String(body.candidate_name).slice(0, MAX_FIELD_LEN) : undefined;
  const applied_date = body.applied_date ? String(body.applied_date).slice(0, 50) : undefined;

  const prompt = `Write a brief, professional follow-up email for a job application. This is NOT a cover letter — it's a polite, concise check-in sent 1–2 weeks after applying.

Application details:
- Company: ${company_name}
- Role: ${job_title}
${applied_date ? `- Applied: ${applied_date}` : ""}
${candidate_name ? `- Candidate name: ${candidate_name}` : ""}

Rules:
- 3–4 sentences maximum. Short is professional.
- Subject line on the first line, formatted as: Subject: [subject here]
- Then a blank line, then the email body
- Do NOT start with "I hope this email finds you well" or any similar opener
- Lead with the role and company, then express continued interest
- Close with "looking forward to hearing from you" or similar
- Confident but not pushy
- Output ONLY the email (subject + body). No explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.parser,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ email: text });
  } catch (err) {
    console.error("[shortlist] follow-up error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to generate follow-up email" }, { status: 500 });
  }
}
