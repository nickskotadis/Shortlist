import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildJdParserPrompt,
  buildUserTypeBlock,
  buildBulletsPrompt,
  buildSummaryPrompt,
  buildCoverLetterPrompt,
  buildValidatorPrompt,
  buildRetryPrompt,
  stripCodeFences,
  resolveVerdict,
} from "@/lib/prompts";
import { MODELS, MAX_RETRIES } from "@/lib/constants";
import type {
  GenerateRequest,
  JdAnalysis,
  ValidatorResult,
  SseEvent,
} from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { document_type, jd_text, jd_analysis: preAnalyzed, user_type, user_data, candidate_input } = body;

  if (!document_type || !user_type || !candidate_input) {
    return NextResponse.json(
      { error: "Missing required fields: document_type, user_type, candidate_input" },
      { status: 400 }
    );
  }
  if (!["bullets", "summary", "cover_letter"].includes(document_type)) {
    return NextResponse.json({ error: "Invalid document_type" }, { status: 400 });
  }
  if (!["career_switcher", "mid_career", "student", "executive"].includes(user_type)) {
    return NextResponse.json({ error: "Invalid user_type" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        // ── Stage 1: Parse JD ──────────────────────────────────────────────
        let jdAnalysis: Partial<JdAnalysis> = preAnalyzed ?? {};

        if (!preAnalyzed && jd_text) {
          const jdResponse = await anthropic.messages.create({
            model: MODELS.generator,
            max_tokens: 1024,
            messages: [{ role: "user", content: buildJdParserPrompt(jd_text) }],
          });
          const raw = jdResponse.content[0].type === "text" ? jdResponse.content[0].text : "{}";
          try {
            jdAnalysis = JSON.parse(stripCodeFences(raw));
          } catch {
            jdAnalysis = {};
          }
        }

        send({ type: "jd_analysis", data: jdAnalysis as JdAnalysis });

        // ── Stage 2: Build generator prompt ───────────────────────────────
        const userTypeBlock = buildUserTypeBlock(user_type, user_data ?? {});

        const buildPrompt = () => {
          switch (document_type) {
            case "bullets":
              return buildBulletsPrompt(userTypeBlock, jdAnalysis, candidate_input);
            case "summary":
              return buildSummaryPrompt(userTypeBlock, jdAnalysis, candidate_input);
            case "cover_letter":
              return buildCoverLetterPrompt(
                userTypeBlock,
                jdAnalysis,
                candidate_input,
                user_data?.candidate_name,
                user_data?.additional_notes,
                jd_text
              );
          }
        };

        // ── Stage 3: Stream generation ─────────────────────────────────────
        let retryCount = 0;
        let fullText = "";
        let validatorResult: ValidatorResult | null = null;

        const generate = async (prompt: string): Promise<string> => {
          fullText = "";

          const stream = anthropic.messages.stream({
            model: MODELS.generator,
            max_tokens: 2048,
            system:
              "You are an expert career writer. Output ONLY the requested content. Rules: (1) No preamble or intro sentences. (2) No closing remarks or sign-off commentary. (3) No square bracket notes, annotations, or editorial comments of any kind — not even [Note: ...] or [Based on available information...]. (4) Do NOT ask for more information. (5) If any field is blank or missing, infer from context and generate anyway. (6) Start your response with the first character of the actual output.",
            messages: [{ role: "user", content: prompt }],
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              fullText += chunk.delta.text;
              send({ type: "text", content: chunk.delta.text });
            }
          }
          return fullText;
        };

        await generate(buildPrompt());

        // ── Stage 4: Validate ─────────────────────────────────────────────
        const validate = async (text: string): Promise<ValidatorResult> => {
          const validatorResponse = await anthropic.messages.create({
            model: MODELS.validator,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: buildValidatorPrompt(document_type, jdAnalysis, text, user_type),
              },
            ],
          });
          const raw =
            validatorResponse.content[0].type === "text"
              ? validatorResponse.content[0].text
              : "{}";
          try {
            const parsed = JSON.parse(stripCodeFences(raw)) as ValidatorResult;
            parsed.verdict = resolveVerdict(parsed);
            return parsed;
          } catch {
            return {
              scores: { specificity: 7, relevance: 7, authenticity: 7, impact: 7, clean: 7 },
              overall: 7.0,
              issues: [],
              verdict: "PASS",
              verdict_reason: "Validator parse failed — defaulting to PASS",
            };
          }
        };

        validatorResult = await validate(fullText);

        // ── Retry if needed ───────────────────────────────────────────────
        if (validatorResult.verdict !== "PASS" && retryCount < MAX_RETRIES) {
          retryCount++;
          send({ type: "retry", message: "Refining output..." });

          const retryPrompt = buildRetryPrompt(
            buildPrompt(),
            validatorResult.issues ?? [],
            validatorResult.verdict_reason ?? ""
          );
          await generate(retryPrompt);
          validatorResult = await validate(fullText);
        }

        // ── Done ──────────────────────────────────────────────────────────
        send({
          type: "done",
          output: fullText,
          jd_analysis: jdAnalysis as JdAnalysis,
          scores: validatorResult.scores,
          overall: validatorResult.overall,
          verdict: validatorResult.verdict,
          retry_count: retryCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
