import { DocumentType, JdAnalysis, UserData, UserType, ValidatorVerdict } from "./types";
import { BANNED_PHRASES } from "./constants";

const banned = BANNED_PHRASES.join(", ");

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const lines = trimmed.split("\n");
  const end = lines[lines.length - 1].trim() === "```" ? lines.length - 1 : lines.length;
  return lines.slice(1, end).join("\n").trim();
}

export function isPass(overall: number, scores: Record<string, number>, minDimension: number): boolean {
  return overall >= 7.0 && Object.values(scores).every((s) => s >= minDimension);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — JD PARSER
// ─────────────────────────────────────────────────────────────────────────────

export function buildJdParserPrompt(jdText: string): string {
  return `You are a senior talent strategist with 15 years of experience reading job descriptions across every industry. Your job is to extract both the explicit requirements and the implicit signals that most candidates miss.

Analyze the following job description and return ONLY a valid JSON object. No explanation, no preamble, no markdown code fences.

Return this exact structure:

{
  "role_title": "exact title from the JD",
  "seniority_level": "entry | junior | mid | senior | staff | lead | principal | director | vp | executive",
  "department": "engineering | product | design | sales | marketing | finance | operations | hr | legal | research | other",
  "industry": "tech | finance | healthcare | consulting | retail | manufacturing | media | education | nonprofit | government | other",
  "company_type": "startup | scaleup | enterprise | agency | nonprofit | government | unknown",
  "explicit_requirements": ["list of clearly stated requirements from the JD"],
  "implicit_signals": {
    "what_they_actually_need": "1-2 sentence description of the real problem this hire solves — read between the lines",
    "seniority_indicators": ["specific phrases from the JD that signal expected experience level"],
    "culture_signals": ["phrases or patterns that indicate company culture or working style"],
    "red_flags": ["anything unusual or concerning — empty array if none"]
  },
  "must_haves": ["non-negotiable requirements — if missing from a resume, likely auto-rejected"],
  "nice_to_haves": ["preferred but not required"],
  "key_terminology": ["domain-specific terms, tools, methodologies to mirror naturally in candidate materials"],
  "tone_target": "formal | professional | conversational | startup-casual | technical | creative",
  "hiring_manager_worry": "single sentence: what is the hiring manager most afraid of getting wrong with this hire?"
}

Job Description:
${jdText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2 — USER TYPE INJECTION BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export function buildUserTypeBlock(userType: UserType, userData: UserData): string {
  switch (userType) {
    case "career_switcher":
      return `USER TYPE: Career Switcher

This candidate is transitioning from ${userData.from_industry ?? "their previous industry"} / ${userData.from_role ?? "their previous role"} into ${userData.to_industry ?? "the target industry"} / ${userData.to_role ?? "the target role"}.
They have ${userData.years_experience ?? "several"} years of professional experience.

CRITICAL FRAMING INSTRUCTIONS:
Do not treat the career change as a liability. Reframe it as a strength — external perspective, cross-domain pattern recognition, and skills that insiders often lack.

Reframing principles:
1. Lead with outcomes and capabilities, never with job titles or industry labels
2. Use the TARGET industry's language to describe PAST work
3. Do not highlight what they lack. Silence is better than a defensive disclaimer. NEVER explain the career transition inline within a bullet or summary sentence. Never write "— the same [skill] required for [target role]" or "— directly mirroring [target role] demands." Let the parallel be implicit. If you are explaining the connection, you have already lost.
4. Side projects and coursework in the target field = real experience. Treat them that way.
5. The narrative arc should feel intentional: not fleeing an old career, moving toward something specific.

Tone: Confident. Grounded. Forward-looking. Never apologetic.`;

    case "mid_career":
      return `USER TYPE: Mid-Career Professional

This candidate has ${userData.years_experience ?? "several"} years of experience in ${userData.industry ?? "their industry"}.
Current level: ${userData.current_level ?? "Senior"}. Target level: ${userData.target_level ?? "Director"}.
Current role: ${userData.current_job_title ?? "current role"}. Target role: ${userData.target_job_title ?? "target role"}.

FRAMING INSTRUCTIONS:
This person is past proving they can do the job. The hiring bar at their level is about ownership, judgment, and impact at scale — not task execution.

Framing principles:
1. Emphasize ownership: budget managed, team size, revenue influenced, customer base served
2. Show trajectory: how has their impact grown across roles?
3. Distinguish decisions from tasks — show decisions made, not tasks completed
4. Frame current achievements at the TARGET level — they are not applying for their current job
5. Quantify everything: team size, budget, revenue, scale

Tone: Direct. Confident. Results-focused. No hedging.`;

    case "student":
      return `USER TYPE: Student / New Graduate

This candidate is a ${userData.degree ?? "Bachelor's"} student / recent graduate from ${userData.school ?? "their university"}${userData.gpa ? ` (GPA: ${userData.gpa})` : ""}, graduating ${userData.grad_year ?? "this year"}.
Target role: ${userData.target_role ?? "their target role"} in ${userData.target_industry ?? "their target industry"}.

FRAMING INSTRUCTIONS:
Extract maximum signal from what they have: projects, internships, coursework, campus roles, self-directed work.

Framing principles:
1. Projects are real work. Frame them exactly like professional role entries with outcomes and metrics.
2. Internship output > internship title. Focus on what was shipped, not where they worked.
3. GPA belongs if strong (3.5+). If not provided or weak, omit it entirely.
4. Frame everything around impact and learning velocity.
5. Hiring at this level is for potential. Show trajectory, not just experience.

Tone: Enthusiastic but grounded. Professional without being stiff.`;

    case "executive":
      return `USER TYPE: Executive

This candidate is targeting ${userData.target_role ?? "executive"} roles with ${userData.years_experience ?? "15+"} years of experience.
Most recent role: ${userData.most_recent_role ?? "senior leadership role"} at ${userData.most_recent_company_type ?? "a large organization"}.

FRAMING INSTRUCTIONS:
At the executive level, this is about narrative, market positioning, and credibility — not job duties.

Framing principles:
1. P&L, org size, and market scope are the primary signals. These belong in the first 30 words of the summary.
2. Every bullet is a strategic narrative: situation → decision → outcome → scale.
3. Selectivity signals confidence. Three outstanding bullets beat eight mediocre ones.
4. External visibility matters: board roles, speaking, published work, industry recognition.
5. Use precise, authoritative language. Eliminate anything defensive, tentative, or explanatory.

Tone: Authoritative. Strategic. Precise. Never braggy — let the numbers speak.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 3 — GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export function buildBulletsPrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string
): string {
  return `${userTypeBlock}

---

You are an elite career strategist and professional writer. You specialize in resume bullets that make hiring managers stop scanning and start reading.

Your writing standards:
- Every bullet starts with a strong, specific, past-tense action verb. Vary them. Choose verbs that carry weight: Architected, Negotiated, Reduced, Grew, Rebuilt, Launched, Diagnosed, Secured, Automated, Streamlined, Spearheaded.
- Quantify every claim that can be quantified. If the candidate did not provide a number, use relative language ("top 10% of team", "within 3 months of joining") — never leave a vague claim unanchored.
- STAR-lite structure: [Action] + [Context or method] + [Measurable result]. Three components, one sentence.
- Mirror terminology from the target job description naturally. Sound like an insider.
- No bullet should describe a task. Every bullet should describe an outcome.
- Prioritize experiences directly relevant to the target role. Deprioritize or omit tangential work entirely in favor of experience that maps to what the role actually requires.

Banned phrases (automatic failure if any appear):
${banned}

---

TARGET ROLE CONTEXT:
Role: ${jdAnalysis.role_title ?? "the target role"}
Seniority: ${jdAnalysis.seniority_level ?? "mid"}
Industry: ${jdAnalysis.industry ?? "the target industry"}
What they actually need: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}
Must-haves to address: ${(jdAnalysis.must_haves ?? []).join(", ")}
Key terminology to mirror: ${(jdAnalysis.key_terminology ?? []).join(", ")}
Tone: ${jdAnalysis.tone_target ?? "professional"}

---

CANDIDATE EXPERIENCE:
${candidateInput}

---

TASK:
Write 5 resume bullets. Each bullet must:
1. Be directly relevant to the target role above — omit tangential experience
2. Demonstrate impact, not activity
3. Include at least one specific metric, scale indicator, or relative benchmark
4. Sound like a credible human professional wrote it

Return ONLY the bullets, one per line, each starting with •. No numbering, no explanation.`;
}

export function buildSummaryPrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string,
  topBullets: string[] = []
): string {
  const bulletContext = topBullets.length > 0
    ? `Top achievements (use for coherence):\n${topBullets.slice(0, 2).join("\n")}`
    : `Candidate background:\n${candidateInput}`;

  return `${userTypeBlock}

---

Write a professional summary for a resume. This is the most-read section — a hiring manager will spend 10 seconds on it and decide whether to continue.

Rules:
- 3–4 sentences. 60–90 words total. COUNT THE WORDS BEFORE RETURNING. If over 90, cut until under. This is a hard constraint, not a guideline.
- No "I" statements. Written in implied third person.
- First sentence: who they are at their highest level — role, years, domain. Specific and non-generic.
- Second sentence: what they are specifically excellent at. Must be specific enough that it could not describe anyone else.
- Third sentence: forward-looking, connects background to target role explicitly.
- Optional fourth sentence: a genuine differentiator. Only include if real and specific.

Banned phrases:
${banned}

---

TARGET ROLE:
Role: ${jdAnalysis.role_title ?? "the target role"}
What they actually need: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}
Hiring manager's worry: ${jdAnalysis.hiring_manager_worry ?? ""}
Tone: ${jdAnalysis.tone_target ?? "professional"}

---

${bulletContext}

---

Return only the summary text. No label, no explanation.`;
}

export function buildCoverLetterPrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string,
  candidateName?: string,
  additionalNotes?: string,
  rawJdText?: string
): string {
  const jobContext = jdAnalysis.role_title
    ? `Company type: ${jdAnalysis.company_type ?? "unknown"}
Role: ${jdAnalysis.role_title}
What they actually need: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}
Hiring manager's worry: ${jdAnalysis.hiring_manager_worry ?? ""}
Culture signals: ${(jdAnalysis.implicit_signals?.culture_signals ?? []).join(", ")}
Key terminology: ${(jdAnalysis.key_terminology ?? []).join(", ")}`
    : rawJdText
    ? `Raw job description (use this to infer all role context):\n${rawJdText}`
    : "No job description provided — infer the role from the candidate's background and target.";

  return `${userTypeBlock}

---

You are writing a cover letter. This is not a template. It is a specific, personal letter from a real person to a real hiring manager at a real company. It must read that way.

STRUCTURE (follow exactly):

Paragraph 1 — The Hook (2–3 sentences)
Do NOT start with "I." Do NOT open with the candidate's name. Do NOT use a generic opener.
Start with an insight about the company's challenge, market position, or the problem this role solves. Then introduce the candidate in relation to that problem.

Paragraph 2 — The Evidence (3–4 sentences)
The 1–2 most relevant achievements from the candidate's background, connected explicitly to this specific role. At least one metric. This paragraph must address the hiring manager's core worry: ${jdAnalysis.hiring_manager_worry ?? ""}

Paragraph 3 — Why This Company (3–4 sentences)
Specific to this company — not generic praise. Reference what the JD reveals about where the company is going, what they're solving, or what kind of person they're building toward.

Paragraph 4 — The Close (2 sentences)
Confident. Not "I hope to hear from you." Express genuine interest and forward momentum.

RULES:
- Total length: 250–350 words. Hard limit.
- Tone: ${jdAnalysis.tone_target ?? "professional"}
- No clichés from the banned list
- No passive voice
- Every sentence earns its place
- NO square bracket notes, annotations, or editorial comments of any kind — not even [Note: ...] or [Based on available information...]
- Output only the letter. Nothing before the first paragraph, nothing after the last.

---

TARGET ROLE:
${jobContext}

---

CANDIDATE:
${candidateName ? `Name: ${candidateName}` : ""}
Background: ${candidateInput}
${additionalNotes ? `Additional notes: ${additionalNotes}` : ""}

---

Start directly with the first sentence of the letter. Do not label paragraphs. Do not add any meta-commentary.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4 — VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

export function buildValidatorPrompt(
  documentType: DocumentType,
  jdAnalysis: Partial<JdAnalysis>,
  output: string,
  userType: UserType
): string {
  return `You are a senior hiring manager reviewing resume/cover letter content. Score harshly. The bar is: "Would a hiring manager at a top company find this compelling and credible?"

Score each dimension 1–10:
1. SPECIFICITY — All claims backed by evidence, metrics, or concrete context?
2. RELEVANCE — Content directly addresses what the target role requires?
3. AUTHENTICITY — Sounds like a real professional wrote it, not AI?
4. IMPACT — Conveys meaningful outcomes, not just activities?
5. CLEAN — Free of clichés, passive voice, and filler phrases?

Banned phrases (any occurrence = immediate flag):
${banned}

---

CONTEXT:
Document type: ${documentType}
Target role: ${jdAnalysis.role_title ?? ""}
User type: ${userType}
What the role actually needs: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}

CONTENT TO REVIEW:
${output}

---

Return ONLY valid JSON. No text outside the JSON, no markdown code fences:

{
  "scores": {
    "specificity": 0,
    "relevance": 0,
    "authenticity": 0,
    "impact": 0,
    "clean": 0
  },
  "overall": 0.0,
  "issues": [
    {
      "type": "banned_phrase | vague_claim | irrelevant | passive_voice | generic | other",
      "location": "exact quote from the output",
      "fix": "specific suggested replacement"
    }
  ],
  "verdict": "PASS | REVISE | REJECT",
  "verdict_reason": "one sentence"
}

Verdict thresholds:
- PASS: overall >= 7.0 AND no individual score below 6
- REVISE: overall >= 5.5 OR any score below 6
- REJECT: overall < 5.5 OR specificity < 4 OR authenticity < 4`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function buildRetryPrompt(
  originalPrompt: string,
  issues: Array<{ type: string; location: string; fix: string }>,
  verdictReason: string
): string {
  const issueList = issues
    .slice(0, 3)
    .map((i) => `[${i.type}] "${i.location}" → Fix: ${i.fix}`)
    .join("\n");

  return `IMPORTANT: A previous generation was flagged for quality issues. Fix these specifically in the new version — do not repeat the same mistakes.

Issues found:
${issueList}

Verdict reason: ${verdictReason}

---

${originalPrompt}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT HELPER — apply our own threshold, not the model's
// ─────────────────────────────────────────────────────────────────────────────

export function resolveVerdict(result: {
  overall: number;
  scores: Record<string, number>;
  verdict: ValidatorVerdict;
}): ValidatorVerdict {
  const { overall, scores } = result;
  if (overall >= 7.0 && Object.values(scores).every((s) => s >= 6)) return "PASS";
  if (overall >= 5.5) return "REVISE";
  return "REJECT";
}
