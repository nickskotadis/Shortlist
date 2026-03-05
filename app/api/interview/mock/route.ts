import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  buildMockInterviewSystemPrompt,
  buildMockInterviewDebriefPrompt,
  stripCodeFences,
} from "@/lib/prompts";
import { MODELS } from "@/lib/constants";
import type { MockInterviewDebrief, MockInterviewMessage } from "@/lib/types";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Require auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Require Pro plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  let body: {
    action: "turn" | "debrief";
    conversation: MockInterviewMessage[];
    resume_text: string;
    jd_text?: string;
    category_focus?: "all" | "behavioral" | "technical" | "situational";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, conversation, resume_text, jd_text = "", category_focus = "all" } = body;

  if (!action || !["turn", "debrief"].includes(action)) {
    return NextResponse.json({ error: "action must be 'turn' or 'debrief'" }, { status: 400 });
  }
  if (!resume_text || typeof resume_text !== "string" || resume_text.trim().length < 50) {
    return NextResponse.json({ error: "resume_text is required (min 50 chars)" }, { status: 400 });
  }
  if (resume_text.length > 20_000) {
    return NextResponse.json({ error: "resume_text too long (max 20,000 chars)" }, { status: 400 });
  }
  if (!Array.isArray(conversation)) {
    return NextResponse.json({ error: "conversation must be an array" }, { status: 400 });
  }
  if (conversation.length > 20) {
    return NextResponse.json({ error: "conversation too long (max 20 turns)" }, { status: 400 });
  }
  const MAX_MSG_LEN = 2000;
  for (const msg of conversation) {
    if (typeof msg.content !== "string" || msg.content.length > MAX_MSG_LEN) {
      return NextResponse.json(
        { error: `Each message must be a string under ${MAX_MSG_LEN} characters` },
        { status: 400 }
      );
    }
  }

  const systemPrompt = buildMockInterviewSystemPrompt(resume_text, jd_text, category_focus);

  // ── TURN: generate next interviewer question/follow-up ─────────────────────
  if (action === "turn") {
    // Build the messages array: map conversation history to Anthropic message format.
    // interviewer messages → assistant, candidate messages → user.
    // First message must always be "user" — we use a consistent initializer prompt.
    const INIT_USER_MSG =
      "Please begin the interview with your first question. Keep it conversational.";

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: INIT_USER_MSG },
    ];

    for (const turn of conversation) {
      messages.push({
        role: turn.role === "interviewer" ? "assistant" : "user",
        content: turn.content,
      });
    }

    // If the last message is from the interviewer (assistant), we need a user message to prompt the next turn
    if (messages[messages.length - 1].role === "assistant") {
      // This shouldn't happen in normal flow — candidate always replies before we call "turn"
      // But guard against it
      return NextResponse.json({ error: "Expected candidate message as last turn" }, { status: 400 });
    }

    try {
      const response = await anthropic.messages.create({
        model: MODELS.generator,
        max_tokens: 256,
        system: systemPrompt,
        messages,
      });

      const message =
        response.content[0].type === "text" ? response.content[0].text.trim() : "";
      return NextResponse.json({ message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      console.error("[shortlist] mock interview turn error:", msg);
      return NextResponse.json({ error: "Failed to generate question — please try again." }, { status: 500 });
    }
  }

  // ── DEBRIEF: generate full session debrief ─────────────────────────────────
  if (action === "debrief") {
    if (conversation.length < 4) {
      return NextResponse.json(
        { error: "Need at least 4 messages to generate a debrief" },
        { status: 400 }
      );
    }

    const debriefPrompt = buildMockInterviewDebriefPrompt(conversation, resume_text, jd_text);

    try {
      const response = await anthropic.messages.create({
        model: MODELS.generator,
        max_tokens: 1024,
        messages: [{ role: "user", content: debriefPrompt }],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
      let result: MockInterviewDebrief;
      try {
        result = JSON.parse(stripCodeFences(raw)) as MockInterviewDebrief;
      } catch {
        return NextResponse.json(
          { error: "Failed to parse debrief — please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Debrief failed";
      console.error("[shortlist] mock interview debrief error:", msg);
      return NextResponse.json({ error: "Failed to generate debrief — please try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
