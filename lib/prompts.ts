import { DocumentType, JdAnalysis, ToneType, UserData, UserType, ValidatorVerdict } from "./types";
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

// Inject a tone override when the user has selected non-default tone
export function buildToneInstruction(tone?: ToneType): string {
  if (!tone || tone === "professional") return "";
  if (tone === "conversational") {
    return `\nTONE OVERRIDE: Write in a warm, approachable, conversational voice. Use natural phrasing and contractions where they fit. Sound like a real, thoughtful professional — not a corporate document.\n`;
  }
  if (tone === "bold") {
    return `\nTONE OVERRIDE: Write in a bold, direct, high-confidence voice. Lead with the most impressive facts. Make strong declarative statements. Cut all hedging language.\n`;
  }
  return "";
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
  candidateInput: string,
  tone?: ToneType
): string {
  return `${userTypeBlock}
${buildToneInstruction(tone)}
---

You are an elite career strategist and professional writer. You specialize in resume bullets that make hiring managers stop scanning and start reading.

QUALITY BAR: Every bullet you write must clear this test — "Could this bullet appear on 50 other people's resumes?" If yes, it's not specific enough. Rewrite it until it couldn't.

Your writing standards:
- Strong, specific, past-tense action verbs. Vary them widely across the 5 bullets — never open two bullets with the same verb. Choose verbs with weight: Architected, Negotiated, Diagnosed, Rebuilt, Secured, Automated, Spearheaded, Reduced, Grew, Launched, Shipped, Recovered, Standardized.
- Quantify every claim that can be quantified. If no specific number exists, use a credible relative anchor: "top 10% of the team", "within 6 weeks of joining", "across 4 product lines", "for 3 enterprise clients" — never leave a claim floating in the abstract.
- STRUCTURAL VARIETY IS REQUIRED. Do not write all 5 bullets in the same [Verb] + [what I did] + [result] pattern — that rhythm exposes template output. Mix it up deliberately:
  - Some bullets open with scale or scope: "Across a 40-person engineering org, ..."
  - Some open with a timeframe: "Within 3 months of joining, ..."
  - Some lead with the outcome first: "Cut deployment time by 60% by redesigning ..."
  - Some focus tightly on one specific technical or strategic decision
- Every bullet must describe an outcome, not an activity. "Managed relationships with 12 enterprise clients" is an activity. "Retained 12 enterprise accounts totaling $4M ARR by rebuilding onboarding and cutting time-to-value from 90 to 30 days" is an outcome.
- Mirror key terminology from the target role naturally — sound like an insider, not a keyword stuffer.
- Ruthlessly prioritize relevance. If an experience doesn't map directly to what this role needs, omit it.

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

---

CANDIDATE EXPERIENCE:
${candidateInput}

---

TASK:
Write 5 resume bullets. Each must be directly relevant to the target role, demonstrate real impact, include at least one specific anchor (number, scale, or relative benchmark), and sound like a credible human professional — not a template.

Return ONLY the bullets, one per line, each starting with •. No numbering, no explanation.`;
}

export function buildSummaryPrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string,
  topBullets: string[] = [],
  tone?: ToneType
): string {
  const bulletContext = topBullets.length > 0
    ? `Top achievements (use for coherence):\n${topBullets.slice(0, 2).join("\n")}`
    : `Candidate background:\n${candidateInput}`;

  return `${userTypeBlock}
${buildToneInstruction(tone)}
---

Write a professional resume summary. This is the most-read section — a hiring manager spends 10 seconds on it. It either earns more attention or loses it.

Rules:
- 3–4 sentences. 60–90 words total. COUNT BEFORE RETURNING. Hard limit.
- No "I" statements. Written in implied third person (no subject pronoun).
- FIRST SENTENCE is the most important. It must NOT be a generic formula like "[Title] with [N] years of experience in [industry]" — that sentence exists on millions of resumes and earns zero attention. Instead: lead with the most compelling, specific thing about this person — their most impressive scope, an unusual combination of skills, or the scale of their best work. If you can imagine it on anyone else's resume, rewrite it.
- Second sentence: the specific thing they are unusually good at. Narrow enough that it couldn't describe a different person.
- Third sentence: connects their background explicitly to the target role — what they bring to this problem specifically.
- Optional fourth sentence: a genuine differentiator (specific credential, unusual background, notable achievement). Only include if it's real and specific — otherwise cut it.

Banned phrases:
${banned}

---

TARGET ROLE:
Role: ${jdAnalysis.role_title ?? "the target role"}
What they actually need: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}
Hiring manager's worry: ${jdAnalysis.hiring_manager_worry ?? ""}

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
  rawJdText?: string,
  tone?: ToneType
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
${buildToneInstruction(tone)}
---

You are writing a cover letter. This is not a template. It is a specific, personal letter from a real person to a real hiring manager at a real company. It must read that way.

VOICE: Write entirely in FIRST PERSON — this letter is from the candidate. Use "I", "my", "me" throughout. The candidate is speaking directly to the hiring manager. The only exception: Paragraph 1's very first sentence must not begin with the word "I" — but the candidate is still the narrator.

STRUCTURE (follow exactly):

Paragraph 1 — The Hook (2–3 sentences)
First sentence: Do NOT start with "I". Do NOT open with the candidate's name. Do NOT use "I am writing to apply." Lead with something sharp — an insight about the company's challenge, where the market is going, or what this role is really solving. The second and third sentences introduce the candidate as the person for that specific problem.

Paragraph 2 — The Evidence (3–4 sentences)
The 1–2 most relevant, specific achievements from the candidate's background — directly tied to what this role requires. At least one concrete metric or scale indicator. This paragraph must directly address the hiring manager's core concern: ${jdAnalysis.hiring_manager_worry ?? "whether this candidate can hit the ground running"}

Paragraph 3 — Why This Company (2–3 sentences)
This is where most cover letters fail — they write generic praise ("I admire your mission" is worthless). Write something specific to what this company is building, solving, or navigating based on what the JD reveals. Show that the candidate actually understands the company's position, not just the job title.

Paragraph 4 — The Close (2 sentences)
Direct and confident. Not "I hope to hear from you" — that's passive and weak. Express clear forward interest.

RULES:
- Total length: 250–350 words. Hard limit. Count before returning.
- No passive voice. Every sentence is active.
- No clichés from the banned list.
- Every sentence earns its place. Cut anything that doesn't add specific signal.
- NO square bracket notes, annotations, or editorial comments of any kind.
- Output only the letter body. Nothing before the first paragraph, nothing after the last.

---

TARGET ROLE:
${jobContext}

---

CANDIDATE:
${candidateName ? `Name: ${candidateName}` : ""}
Background: ${candidateInput}
${additionalNotes ? `Additional notes: ${additionalNotes}` : ""}

---

Start directly with the first sentence of Paragraph 1. Do not label paragraphs. Do not add any meta-commentary.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKEDIN GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export function buildLinkedInAboutPrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string,
  tone?: ToneType
): string {
  return `${userTypeBlock}
${buildToneInstruction(tone)}
---

Write a LinkedIn About section. This is the most-read section of a LinkedIn profile. It needs to work for recruiters who search for keywords AND hiring managers who visit the profile directly.

Rules:
- 200–300 words. First-person voice ("I" is allowed and natural here — this is a personal profile, not a resume).
- Lead with who you are and the problem you solve — not your job title.
- Include 2–3 specific, quantified achievements woven naturally into the narrative.
- End with a clear signal of what you're looking for or open to.
- Optimized for LinkedIn's algorithm: naturally incorporate relevant keywords from the target role without keyword stuffing.
- No bullet points — flowing paragraphs only (LinkedIn formatting).
- Do NOT start with "I am" or "I'm a." Start with a hook that earns attention.

Banned phrases:
${banned}

---

TARGET CONTEXT:
Role: ${jdAnalysis.role_title ?? "target role"}
Industry: ${jdAnalysis.industry ?? "target industry"}
Key terminology: ${(jdAnalysis.key_terminology ?? []).join(", ")}

---

CANDIDATE BACKGROUND:
${candidateInput}

---

Return only the About text. No label, no explanation.`;
}

export function buildLinkedInHeadlinePrompt(
  userTypeBlock: string,
  jdAnalysis: Partial<JdAnalysis>,
  candidateInput: string,
  tone?: ToneType
): string {
  return `${userTypeBlock}
${buildToneInstruction(tone)}
---

Write a LinkedIn Headline. This 220-character field appears in search results and is the first thing recruiters see.

Rules:
- Maximum 220 characters (hard limit — count before returning).
- Keyword-dense: include role title, key skills, and/or industry terms that recruiters actually search for.
- Differentiated: not just a job title. Show what makes this person distinctive.
- Format options (pick the best fit):
  - "[Role] | [Key strength] | [Notable achievement or credential]"
  - "[Role] helping [type of company/customer] [outcome]"
  - "[Specific skill] + [specific skill] = [result they deliver]"
- No generic phrases like "Passionate about..." or "Experienced professional"

TARGET CONTEXT:
Role: ${jdAnalysis.role_title ?? "target role"}
Key terminology: ${(jdAnalysis.key_terminology ?? []).join(", ")}

CANDIDATE BACKGROUND:
${candidateInput}

Return only the headline text. No label, no explanation.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4 — VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

export function buildValidatorPrompt(
  documentType: DocumentType,
  jdAnalysis: Partial<JdAnalysis>,
  output: string,
  userType: UserType,
  candidateInput: string
): string {
  return `You are a senior hiring manager reviewing resume/cover letter content. Your job has two parts: quality scoring and hallucination detection.

── PART 1: QUALITY SCORING ───────────────────────────────────────────────────

Score each dimension 1–10:
1. SPECIFICITY — All claims backed by evidence, metrics, or concrete context?
2. RELEVANCE — Content directly addresses what the target role requires?
3. AUTHENTICITY — Sounds like a real professional wrote it, not AI?
4. IMPACT — Conveys meaningful outcomes, not just activities?
5. CLEAN — Free of clichés, passive voice, and filler phrases?

Banned phrases (any occurrence = immediate flag):
${banned}

── PART 2: HALLUCINATION CHECK ───────────────────────────────────────────────

Compare the generated output against the candidate's original input below. Flag every specific claim in the output that cannot be traced back to what the candidate actually told us.

Flag as type "hallucination":
- Specific numbers (percentages, dollar amounts, headcount, timeframes like "in 3 months") that do NOT appear in the candidate input
- Named skills, tools, languages, or technologies not mentioned by the candidate
- Credentials, certifications, degrees, company names, or titles not in the candidate input

Flag as type "skill_inflation":
- Skills or tools the candidate mentioned but the output overstates (e.g., candidate said "familiar with Python", output claims "expert Python developer")

Do NOT flag:
- Qualitative framing consistent with the described role ("led cross-functional teams", "managed stakeholder relationships")
- JD terminology mirrored in a non-claim context (role language, industry vocabulary)
- Relative benchmarks without a fabricated number ("significant growth", "top performer")
- Reasonable structural inferences from the user type (e.g., an executive likely had P&L exposure)

CANDIDATE'S ORIGINAL INPUT:
${candidateInput}

── CONTEXT ────────────────────────────────────────────────────────────────────

Document type: ${documentType}
Target role: ${jdAnalysis.role_title ?? ""}
User type: ${userType}
What the role actually needs: ${jdAnalysis.implicit_signals?.what_they_actually_need ?? ""}

── GENERATED OUTPUT TO REVIEW ─────────────────────────────────────────────────

${output}

──────────────────────────────────────────────────────────────────────────────

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
      "type": "hallucination | skill_inflation | banned_phrase | vague_claim | irrelevant | passive_voice | generic | other",
      "location": "exact quote from the output",
      "fix": "specific instruction or replacement"
    }
  ],
  "verdict": "PASS | REVISE | REJECT",
  "verdict_reason": "one sentence"
}

Verdict thresholds:
- PASS: overall >= 7.0 AND no individual score below 6
- REVISE: overall >= 5.5 OR any score below 6
- REJECT: overall < 5.5 OR specificity < 4 OR authenticity < 4

Note: hallucination/skill_inflation issues are always flagged in the issues list regardless of verdict, so the user can review them before submitting.`;
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
  issues?: Array<{ type: string }>;
}): ValidatorVerdict {
  const { overall, scores } = result;
  // Hallucination issues are surfaced to the user via the issues list but do not
  // drive retries — retrying won't fix invented metrics when the input is vague.
  // Quality scores (especially Specificity) already penalise hallucinated claims.
  if (overall >= 7.0 && Object.values(scores).every((s) => s >= 6)) return "PASS";
  if (overall >= 5.5) return "REVISE";
  return "REJECT";
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUME HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────────

export function buildHealthScorePrompt(resumeText: string): string {
  return `You are a senior recruiter and career coach. Analyze this resume and return a structured quality assessment.

Score each dimension 1–10:
1. CLARITY — Is the resume easy to read and scan? Clear sections, logical flow, no confusing structure?
2. IMPACT — Do bullets/statements convey achievement and outcome, not just job duties?
3. ATS_FRIENDLINESS — Will ATS systems parse this correctly? Avoids tables, graphics, complex formatting, uses standard section names?
4. ACTION_VERBS — Do bullets start with strong, specific past-tense action verbs? Or weak/passive openers?
5. QUANTIFICATION — What percentage of claims include specific numbers, metrics, percentages, or dollar amounts?

Return ONLY valid JSON:

{
  "scores": {
    "clarity": 0,
    "impact": 0,
    "ats_friendliness": 0,
    "action_verbs": 0,
    "quantification": 0
  },
  "overall": 0.0,
  "recommendations": [
    "specific, actionable suggestion 1",
    "specific, actionable suggestion 2",
    "specific, actionable suggestion 3"
  ],
  "word_count": 0
}

Rules:
- overall = average of all 5 scores
- recommendations: exactly 3–5 items, each a specific action the candidate can take right now
- word_count: approximate word count of the resume
- No text outside the JSON

RESUME:
${resumeText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAILORING RECOMMENDATIONS — post-generation checklist
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW PREP — tailored questions with STAR frameworks
// ─────────────────────────────────────────────────────────────────────────────

export function buildInterviewPrepPrompt(jdText: string, resumeText: string): string {
  const jdSection = jdText.trim()
    ? `JOB DESCRIPTION:\n${jdText.trim()}`
    : "No job description provided — generate universally strong questions appropriate for the experience level and background described in the resume.";

  return `You are a senior talent acquisition strategist with 15 years of experience conducting interviews across every industry. Your job is to anticipate exactly what interviewers will ask and help candidates answer brilliantly.

Analyze the following inputs and generate exactly 6–8 tailored interview questions. Cover all 4 categories: behavioral, technical, situational, culture. If no JD is provided, infer the target role from the resume and generate questions that would apply to any interview at that experience level.

For each question:
- Write it exactly as an interviewer would ask it out loud
- Explain what the interviewer is actually trying to assess (why_asked) — be specific, not generic
- Provide a concrete STAR-format answer framework (framework) that is specifically tailored to the candidate's resume background — reference their actual experience where possible

Return ONLY valid JSON in this exact structure, no wrapper text, no markdown:

{
  "questions": [
    {
      "question": "exact question as the interviewer would ask it",
      "category": "behavioral | technical | situational | culture",
      "why_asked": "what the interviewer is actually assessing — be specific",
      "framework": "STAR-format answer guidance tailored to this candidate's background"
    }
  ]
}

Requirements:
- Exactly 6–8 questions total
- At least 1 question per category (behavioral, technical, situational, culture)
- Questions must be specific to this role/candidate — not generic filler
- framework must reference the candidate's actual background from their resume
- No text outside the JSON object

${jdSection}

CANDIDATE RESUME:
${resumeText.trim()}`;
}

export function buildTailoringRecommendationsPrompt(
  resumeText: string,
  jdAnalysis: Partial<JdAnalysis>,
  generatedOutput: string
): string {
  return `You are a professional resume coach. A candidate just generated AI-tailored resume content. Your job is to give them 3–5 specific, actionable changes to make in their actual base resume — so it better matches the target role.

Focus on:
- Skills or tools from the JD that are missing or underemphasized in the resume
- Weak or vague bullets that should be replaced with metric-backed versions
- Section structure improvements (e.g., add quantification, reorder, rename sections)
- ATS keywords from the JD that don't appear in the resume

Target role: ${jdAnalysis.role_title ?? "the target role"}
Must-haves from JD: ${(jdAnalysis.must_haves ?? []).join(", ")}
Key terminology: ${(jdAnalysis.key_terminology ?? []).join(", ")}

CANDIDATE'S RESUME:
${resumeText || "(no resume provided — give general advice based on the JD)"}

GENERATED OUTPUT (for reference — what we tailored to):
${generatedOutput.slice(0, 500)}

Return ONLY a JSON array of 3–5 strings. Each string is one specific, actionable recommendation in plain English. No labels, no numbering, no markdown:

["recommendation 1", "recommendation 2", "recommendation 3"]

Make each recommendation concrete and specific to what you see — not generic advice.`;
}
