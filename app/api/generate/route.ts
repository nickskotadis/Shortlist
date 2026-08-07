import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
import {
  buildJdParserPrompt,
  buildUserTypeBlock,
  buildValidatorPrompt,
  buildRetryPrompt,
  buildTailoringRecommendationsPrompt,
  resolveVerdict,
} from "@/lib/prompts";
import { GENERATOR_SYSTEM_PROMPT, MAX_TOKENS, buildDocPrompt } from "@/lib/pipeline";
import { parseJson, parseLlmJson } from "@/lib/llm-json";
import { MODELS, MAX_RETRIES, PROMPT_VERSIONS, FREE_MONTHLY_LIMIT, PROMPT_AB_VARIANT, ANON_GENERATE_LIMIT, ANON_GENERATE_WINDOW_SEC } from "@/lib/constants";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type {
  GenerateRequest,
  JdAnalysis,
  ValidatorResult,
  SseEvent,
} from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── JD analysis cache ─────────────────────────────────────────────────────────
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const JD_CACHE_TTL = 3600; // 1 hour

function jdCacheKey(jdText: string): string {
  return `jd:${createHash("sha256").update(jdText.trim()).digest("hex").slice(0, 32)}`;
}

// ── Input length limits ────────────────────────────────────────────────────────
const LIMITS = {
  candidateMin: 50,
  candidateMax: 8_000,
  jdMax: 15_000,
};

const VALID_DOC_TYPES = ["bullets", "summary", "cover_letter", "linkedin_about", "linkedin_headline"];
const VALID_USER_TYPES = ["career_switcher", "mid_career", "student", "executive"];

// LinkedIn doc types don't require JD (they work from resume alone)
const JD_OPTIONAL_TYPES = new Set(["linkedin_about", "linkedin_headline"]);

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    document_type,
    jd_text,
    jd_analysis: preAnalyzed,
    user_type,
    candidate_input,
  } = body;
  let { tone } = body;

  // BUG-03: cap all user_data string fields to prevent prompt stuffing
  const MAX_FIELD_LEN = 200;
  const user_data = body.user_data
    ? (Object.fromEntries(
        Object.entries(body.user_data).map(([k, v]) => [
          k,
          typeof v === "string" ? v.slice(0, MAX_FIELD_LEN) : v,
        ])
      ) as typeof body.user_data)
    : body.user_data;

  // ── Field validation ─────────────────────────────────────────────────────────
  if (!document_type || !user_type || !candidate_input) {
    return NextResponse.json(
      { error: "Missing required fields: document_type, user_type, candidate_input" },
      { status: 400 }
    );
  }
  if (!VALID_DOC_TYPES.includes(document_type)) {
    return NextResponse.json({ error: "Invalid document_type" }, { status: 400 });
  }
  if (!VALID_USER_TYPES.includes(user_type)) {
    return NextResponse.json({ error: "Invalid user_type" }, { status: 400 });
  }
  // BUG-13: validate tone to prevent arbitrary string injection into prompts
  const VALID_TONES = ["professional", "conversational", "bold"];
  if (tone && !VALID_TONES.includes(tone)) {
    tone = "professional";
  }

  // ── Input length validation ──────────────────────────────────────────────────
  if (candidate_input.trim().length < LIMITS.candidateMin) {
    return NextResponse.json(
      { error: "Please tell us more about your experience — at least a sentence or two." },
      { status: 400 }
    );
  }
  if (candidate_input.length > LIMITS.candidateMax) {
    return NextResponse.json(
      { error: "Experience input is too long. Paste your most relevant experience (max 8,000 characters)." },
      { status: 400 }
    );
  }
  if (jd_text && jd_text.length > LIMITS.jdMax) {
    return NextResponse.json(
      { error: "Job description is too long. Paste the core sections — responsibilities and requirements (max 15,000 characters)." },
      { status: 400 }
    );
  }

  // ── Get authenticated user (optional — generation works for all) ─────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Rate limit check ───────────────────────────────────────────────────────
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profile?.plan === "free") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart);

      if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json(
          { error: "monthly_limit_reached" },
          { status: 429 }
        );
      }
    }
  } else {
    // Anonymous generation is deliberate, but must be bounded per IP so it
    // can't be scripted into unlimited Sonnet spend.
    const ip = getClientIp(req);
    const { allowed, retryAfterSec } = await rateLimit(
      `gen:${ip}`,
      ANON_GENERATE_LIMIT,
      ANON_GENERATE_WINDOW_SEC
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "You've reached the limit for anonymous generations. Sign in to keep going — it's free." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
  }

  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let fullText = "";
      let retryCount = 0;
      let validatorResult: ValidatorResult | null = null;

      try {
        // ── Stage 1: Parse JD (Haiku — cache-first, 1h TTL) ─────────────────────

        // BUG-04: sanitize client-supplied jd_analysis to prevent prompt injection
        // through pre-analyzed fields that bypass JD text length limits
        const sanitizeJdField = (v: unknown, maxLen: number): unknown => {
          if (typeof v === "string") return v.slice(0, maxLen);
          if (Array.isArray(v)) return v.slice(0, 20).map((item) => sanitizeJdField(item, maxLen));
          if (v && typeof v === "object") {
            return Object.fromEntries(
              Object.entries(v as Record<string, unknown>).map(([k, val]) => [
                k,
                sanitizeJdField(val, maxLen),
              ])
            );
          }
          return v;
        };
        const sanitizedPreAnalyzed = preAnalyzed
          ? (sanitizeJdField(preAnalyzed, 200) as Partial<JdAnalysis>)
          : undefined;

        let jdAnalysis: Partial<JdAnalysis> = sanitizedPreAnalyzed ?? {};

        const needsJd = !JD_OPTIONAL_TYPES.has(document_type);

        if (!sanitizedPreAnalyzed && jd_text) {
          let cacheHit = false;

          if (redis) {
            try {
              const cached = await redis.get<JdAnalysis>(jdCacheKey(jd_text));
              if (cached) {
                jdAnalysis = cached;
                cacheHit = true;
              }
            } catch {
              // Cache read failed — fall through to Haiku
            }
          }

          if (!cacheHit) {
            // parseLlmJson, not parseJson: the parser intermittently emits JSON
            // that won't balance (~11% of calls, independent across attempts,
            // unrelated to the token budget). Without a second attempt those
            // failures fall through to an empty analysis and the generator runs
            // with no knowledge of the job description at all. The validator has
            // always had this retry; the JD parse did not.
            const parsedJd = await parseLlmJson<Partial<JdAnalysis>>(async () => {
              const jdResponse = await anthropic.messages.create({
                model: MODELS.parser,
                max_tokens: MAX_TOKENS.parser,
                messages: [{ role: "user", content: buildJdParserPrompt(jd_text) }],
              });

              totalInputTokens += jdResponse.usage.input_tokens;
              totalOutputTokens += jdResponse.usage.output_tokens;

              return jdResponse.content[0]?.type === "text"
                ? jdResponse.content[0].text
                : "";
            });
            jdAnalysis = parsedJd.ok ? parsedJd.value : {};

            // Store in cache — fire-and-forget, never block the response
            if (redis && Object.keys(jdAnalysis).length > 0) {
              redis.set(jdCacheKey(jd_text), jdAnalysis, { ex: JD_CACHE_TTL }).catch(() => {});
            }
          }
        } else if (!sanitizedPreAnalyzed && !jd_text && needsJd) {
          // No JD provided and doc type requires it — proceed with empty analysis
          jdAnalysis = {};
        }

        send({ type: "jd_analysis", data: jdAnalysis as JdAnalysis });

        // ── Stage 2: Build generator prompt ─────────────────────────────────────
        const userTypeBlock = buildUserTypeBlock(user_type, user_data ?? {});

        const buildPrompt = () =>
          buildDocPrompt({
            documentType: document_type,
            userTypeBlock,
            jdAnalysis,
            candidateInput: candidate_input,
            tone,
            userData: user_data,
            jdText: jd_text,
          });

        // ── Stage 3: Stream generation ───────────────────────────────────────────
        const generate = async (prompt: string): Promise<string> => {
          fullText = "";

          const msgStream = anthropic.messages.stream({
            model: MODELS.generator,
            max_tokens: MAX_TOKENS.generator,
            system: GENERATOR_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
          });

          for await (const chunk of msgStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              fullText += chunk.delta.text;
              send({ type: "text", content: chunk.delta.text });
            }
          }

          const finalMsg = await msgStream.finalMessage();
          totalInputTokens += finalMsg.usage.input_tokens;
          totalOutputTokens += finalMsg.usage.output_tokens;

          return fullText;
        };

        await generate(buildPrompt());

        // ── Stage 4: Validate ────────────────────────────────────────────────────
        const validate = async (text: string): Promise<ValidatorResult> => {
          const parsed = await parseLlmJson<ValidatorResult>(async () => {
            const validatorResponse = await anthropic.messages.create({
              model: MODELS.validator,
              max_tokens: MAX_TOKENS.validator,
              messages: [
                {
                  role: "user",
                  content: buildValidatorPrompt(document_type, jdAnalysis, text, user_type, candidate_input),
                },
              ],
            });
            totalInputTokens += validatorResponse.usage.input_tokens;
            totalOutputTokens += validatorResponse.usage.output_tokens;
            return validatorResponse.content[0]?.type === "text"
              ? validatorResponse.content[0].text
              : "";
          });

          if (parsed.ok) {
            parsed.value.verdict = resolveVerdict(parsed.value);
            return parsed.value;
          }

          // Fail CLOSED: the validator response was unparseable even after one
          // retry. Never fabricate a PASS — report the quality gate as
          // unavailable so the client can show a neutral (not fake-pass) state.
          return {
            scores: { specificity: 0, relevance: 0, authenticity: 0, impact: 0, clean: 0 },
            overall: 0,
            issues: [],
            verdict: "REVISE",
            verdict_reason: "Quality validation unavailable — output not graded.",
            unavailable: true,
          };
        };

        validatorResult = await validate(fullText);

        // ── Retry if needed ──────────────────────────────────────────────────────
        // Don't retry when validation was unavailable — an ungraded output tells
        // us nothing about whether a retry would help.
        if (!validatorResult.unavailable && validatorResult.verdict !== "PASS" && retryCount < MAX_RETRIES) {
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

        const promptVersion = PROMPT_VERSIONS[document_type as keyof typeof PROMPT_VERSIONS] ?? document_type;

        // ── Persist to DB (authenticated users only) ─────────────────────────────
        // Insert before sending "done" so we can include the generation_id.
        let generationId: string | null = null;

        if (user) {
          const hasMetrics = /[\d%$€£]/.test(candidate_input);
          const candidateWordCount = candidate_input.trim().split(/\s+/).length;
          const jdWordCount = jd_text ? jd_text.trim().split(/\s+/).length : 0;

          // Verify job_application_id belongs to this user before linking
          let verifiedJobApplicationId: string | null = null;
        if (body.job_application_id) {
          const { count } = await supabase
            .from("job_applications")
            .select("id", { count: "exact", head: true })
            .eq("id", body.job_application_id)
            .eq("user_id", user.id);
          if (count && count > 0) verifiedJobApplicationId = body.job_application_id;
        }

        const { data: insertData, error: dbError } = await supabase
            .from("generations")
            .insert({
              user_id: user.id,
              job_application_id: verifiedJobApplicationId,
              document_type,
              user_type,
              tone: tone ?? "professional",
              input_snapshot: {
                user_type,
                document_type,
                candidate_word_count: candidateWordCount,
                jd_word_count: jdWordCount,
                has_metrics: hasMetrics,
              },
              output_text: fullText,
              prompt_version: promptVersion,
              model_used: MODELS.generator,
              input_tokens: totalInputTokens,
              output_tokens: totalOutputTokens,
              latency_ms: Date.now() - startTime,
              validator_scores: validatorResult.unavailable ? null : validatorResult.scores,
              validator_verdict: validatorResult.unavailable ? null : validatorResult.verdict,
              retry_count: retryCount,
              ab_variant: PROMPT_AB_VARIANT,
            })
            .select("id")
            .single();

          if (dbError) {
            // Don't surface DB errors to the user — generation already succeeded
            console.error("[shortlist] Failed to save generation:", dbError.message);
          } else if (insertData) {
            generationId = insertData.id;
          }
        }

        // ── Done ─────────────────────────────────────────────────────────────────
        send({
          type: "done",
          output: fullText,
          jd_analysis: jdAnalysis as JdAnalysis,
          scores: validatorResult.scores,
          overall: validatorResult.overall,
          verdict: validatorResult.verdict,
          validation_unavailable: validatorResult.unavailable ?? false,
          retry_count: retryCount,
          prompt_version: promptVersion,
          issues: validatorResult.issues,
          generation_id: generationId ?? undefined,
          keywords: (jdAnalysis as JdAnalysis).key_terminology ?? [],
        });

        // ── Stage 5: Tailoring recommendations (fire-and-forget Haiku call) ──────────
        // Only when we have resume context (candidate_input is long enough to analyze)
        if (candidate_input.length > 200 && jdAnalysis.key_terminology) {
          try {
            const tailoringResponse = await anthropic.messages.create({
              model: MODELS.parser,
              max_tokens: MAX_TOKENS.tailoring,
              messages: [{
                role: "user",
                content: buildTailoringRecommendationsPrompt(candidate_input, jdAnalysis, fullText),
              }],
            });
            const raw = tailoringResponse.content[0]?.type === "text" ? tailoringResponse.content[0].text : "";
            const parsedTailoring = parseJson<string[]>(raw);
            if (parsedTailoring.ok && Array.isArray(parsedTailoring.value) && parsedTailoring.value.length > 0) {
              send({ type: "tailoring_suggestions", suggestions: parsedTailoring.value });
            }
          } catch {
            // Non-critical — tailoring recs are optional
          }
        }
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
