import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildNegotiationPrompt, stripCodeFences } from "@/lib/prompts";
import { MODELS } from "@/lib/constants";
import type { NegotiationResult } from "@/lib/types";

export const maxDuration = 60;

const MAX_FIELD_LEN = 500;

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
    company: string;
    role: string;
    current_offer: number;
    target_offer: number;
    currency?: string;
    bonus?: string;
    equity?: string;
    competing_offer?: string;
    notes?: string;
    resume_text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    company,
    role,
    current_offer,
    target_offer,
    currency = "USD",
    bonus = "",
    equity = "",
    competing_offer = "",
    notes = "",
    resume_text = "",
  } = body;

  // Validate required fields
  if (!company || typeof company !== "string" || !company.trim()) {
    return NextResponse.json({ error: "company is required" }, { status: 400 });
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }
  if (typeof current_offer !== "number" || current_offer <= 0) {
    return NextResponse.json({ error: "current_offer must be a positive number" }, { status: 400 });
  }
  if (typeof target_offer !== "number" || target_offer <= 0) {
    return NextResponse.json({ error: "target_offer must be a positive number" }, { status: 400 });
  }
  if (target_offer <= current_offer) {
    return NextResponse.json(
      { error: "target_offer must be greater than current_offer" },
      { status: 400 }
    );
  }

  // Sanitize string fields to prevent prompt injection
  const sanitize = (s: string) => (typeof s === "string" ? s.slice(0, MAX_FIELD_LEN) : "");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.generator,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildNegotiationPrompt(
            {
              company: sanitize(company),
              role: sanitize(role),
              current_offer,
              target_offer,
              currency: sanitize(currency),
              bonus: sanitize(bonus),
              equity: sanitize(equity),
              competing_offer: sanitize(competing_offer),
              notes: sanitize(notes),
            },
            resume_text ? sanitize(resume_text.slice(0, 8000)) : undefined
          ),
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let result: NegotiationResult;
    try {
      result = JSON.parse(stripCodeFences(raw)) as NegotiationResult;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse negotiation result — please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Negotiation coaching failed";
    console.error("[shortlist] negotiate error:", message);
    return NextResponse.json(
      { error: "Failed to generate negotiation strategy — please try again." },
      { status: 500 }
    );
  }
}
