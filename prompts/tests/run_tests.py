"""
Shortlist Prompt Test Runner
----------------------------
Runs all 3 test cases end-to-end:
  1. JD Parser
  2. Bullet Generator
  3. Professional Summary Generator
  4. Quality Validator

Usage:
  export ANTHROPIC_API_KEY=your_key_here
  python3 prompts/tests/run_tests.py

Requires:
  pip install anthropic
"""

import os
import json
import textwrap
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SONNET = "claude-sonnet-4-6"
HAIKU  = "claude-haiku-4-5-20251001"

BANNED_PHRASES = [
    "results-driven", "results-oriented", "passionate about", "passionate professional",
    "team player", "proven track record", "self-starter", "detail-oriented",
    "hard-working", "hardworking", "go-getter", "synergy", "synergize",
    "leverage", "utilize", "dynamic professional", "innovative", "visionary",
    "thought leader", "best-in-class", "was responsible for", "helped with",
    "assisted in", "I am writing to apply", "I would be a great fit",
    "Please find my resume attached", "Thank you for your time and consideration",
    "To whom it may concern"
]

# ─────────────────────────────────────────────
# TEST CASE DEFINITIONS
# ─────────────────────────────────────────────

TEST_CASES = [
    {
        "id": "TC1",
        "label": "Career Switcher — Teacher → Product Manager",
        "user_type": "Career Switcher",
        "from_role": "High school history teacher",
        "from_industry": "Education",
        "to_role": "Associate Product Manager",
        "to_industry": "B2B SaaS (HR Tech)",
        "years_experience": "7",
        "jd_text": """
Associate Product Manager — Series B HR Tech Startup (50 employees)

We're building the operating system for modern HR teams. Our product helps People Ops leaders
at mid-market companies run performance reviews, onboarding, and employee engagement — all in one place.

We're looking for an APM to join our product team and work directly with customers and engineers to
define what we build next.

What you'll do:
- Talk to customers weekly to understand their problems and workflows
- Write clear product specs and user stories that engineers can build from
- Analyze usage data to identify drop-off points and prioritization opportunities
- Work cross-functionally with design, engineering, and customer success
- Help define our product roadmap for the next 6–12 months

What we're looking for:
- Strong written and verbal communication — you can explain complex problems simply
- Customer empathy — you've spent real time understanding user needs
- Analytical thinking — you're comfortable in spreadsheets and can read basic SQL
- Ability to move fast and make decisions with incomplete information
- Experience building or shipping any kind of product (even side projects) is a strong plus
- No specific industry background required — we care more about mindset than resume
        """,
        "candidate_raw_input": """
I've been a high school history teacher for 7 years. I designed a new curriculum from scratch
that improved test scores. I managed a team of 5 student teachers as a department coordinator.
I've been building an app on the side to help teachers track student progress — about 200 teachers
use it now. I've always been fascinated by how software products are built and I've taken a
Product School course. I've also led parent-teacher conference logistics for the whole school
(about 500 families), which involved coordinating 30 teachers and building a scheduling system.
        """,
    },
    {
        "id": "TC2",
        "label": "Mid-Career — Senior Marketing Manager → Director of Marketing",
        "user_type": "Mid-Career Professional",
        "current_level": "Senior Marketing Manager",
        "target_level": "Director of Marketing",
        "years_experience": "9",
        "industry": "B2B SaaS",
        "current_role": "Senior Marketing Manager",
        "target_role": "Director of Marketing",
        "jd_text": """
Director of Marketing — Series C SaaS Company (300 employees)

We're a revenue intelligence platform for enterprise sales teams. $40M ARR, growing 80% YoY.
We've closed our Series C and are ready to scale the marketing function from scrappy to systematic.

This role owns the full marketing function. You'll report directly to the CMO and manage a
team of 4, with budget authority over $2M in spend.

Responsibilities:
- Own demand generation strategy and pipeline targets
- Manage and develop a 4-person team across content, paid, and events
- Lead our category positioning and messaging work
- Partner with Sales leadership on lead quality, pipeline coverage, and win/loss
- Build the reporting infrastructure to connect marketing activity to revenue

What we need:
- 7–12 years of B2B marketing experience, with 3+ years in a people management role
- Demonstrated track record of hitting pipeline targets in a high-growth SaaS environment
- Experience with category creation or significant repositioning work
- Ability to operate strategically and tactically — we don't have a large team
- Strong relationship with Sales — you've built trust across the aisle before
        """,
        "candidate_raw_input": """
I've been a Senior Marketing Manager for 4 years at a 150-person SaaS startup. I manage a
team of 3 (content writer, paid specialist, and a marketing ops person). We run demand gen —
hit our pipeline targets every quarter for 2 years straight. I launched a category repositioning
last year that shifted how we talk about our product — went from "project management tool" to
"operational intelligence platform" and got us into TechCrunch and two other tier-1 publications.
I manage an $800K budget. I've worked closely with our VP of Sales on lead scoring — we redesigned
the whole MQL definition together. Before this I was a marketing manager at a larger enterprise
software company for 3 years and an analyst before that.
        """,
    },
    {
        "id": "TC3",
        "label": "Student — CS Senior → Software Engineer",
        "user_type": "Student / New Graduate",
        "degree": "Bachelor's in Computer Science",
        "school": "University of Illinois Urbana-Champaign",
        "grad_year": "2025",
        "gpa": "3.7",
        "target_role": "Software Engineer",
        "target_industry": "Tech",
        "jd_text": """
Software Engineer — Growth-Stage Fintech (Series C, 400 employees)

We're building real-time payments infrastructure for the next generation of financial products.
Our platform processes $5B+ in annual transaction volume and we're growing fast.

We're looking for a software engineer to join our core payments team. You'll work on the systems
that handle transaction processing, retry logic, and payment method integrations.

What you'll do:
- Build and maintain backend services in Python and Go
- Own features end-to-end from design through production
- Write high-quality, well-tested code — we have high standards
- Debug production issues and be part of on-call rotation
- Collaborate directly with senior engineers and contribute to architecture decisions

What we're looking for:
- Strong fundamentals in computer science (data structures, algorithms, systems)
- Experience with Python, Go, or similar backend languages
- Understanding of distributed systems concepts
- Experience writing production code — internships count
- Attention to correctness and edge cases — this is payments, bugs are expensive
        """,
        "candidate_raw_input": """
I interned at a mid-size payments company last summer. I built an API endpoint for recurring
payment processing that went to production and handled real transaction data. I also found and
fixed a bug in the payment retry logic that had been causing some transactions to fail silently.
I was a TA for Data Structures for 2 semesters. For a class ML project I built a sentiment
analysis model that got 91% accuracy on a financial news dataset. I'm comfortable with Python,
Java, and some Go. GPA 3.7.
        """,
    },
]

# ─────────────────────────────────────────────
# PROMPT BUILDERS
# ─────────────────────────────────────────────

def build_jd_parser_prompt(jd_text: str) -> str:
    return f"""You are a senior talent strategist with 15 years of experience reading job descriptions across every industry. Your job is to extract both the explicit requirements and the implicit signals that most candidates miss.

Analyze the following job description and return ONLY a valid JSON object. No explanation, no preamble.

Return this exact structure:

{{
  "role_title": "exact title from the JD",
  "seniority_level": "entry | junior | mid | senior | staff | lead | principal | director | vp | executive",
  "department": "engineering | product | design | sales | marketing | finance | operations | hr | legal | research | other",
  "industry": "tech | finance | healthcare | consulting | retail | manufacturing | media | education | nonprofit | government | other",
  "company_type": "startup | scaleup | enterprise | agency | nonprofit | government | unknown",
  "explicit_requirements": ["list of clearly stated requirements from the JD"],
  "implicit_signals": {{
    "what_they_actually_need": "1-2 sentence description of the real problem this hire solves",
    "seniority_indicators": ["specific phrases from the JD that signal expected experience level"],
    "culture_signals": ["phrases or patterns that indicate company culture or working style"],
    "red_flags": ["anything unusual or concerning — empty array if none"]
  }},
  "must_haves": ["non-negotiable requirements"],
  "nice_to_haves": ["preferred but not required"],
  "key_terminology": ["domain-specific terms, tools, methodologies to mirror naturally"],
  "tone_target": "formal | professional | conversational | startup-casual | technical | creative",
  "hiring_manager_worry": "single sentence: what is the hiring manager most afraid of getting wrong with this hire?"
}}

Job Description:
{jd_text}"""


def build_user_type_block(tc: dict) -> str:
    if tc["user_type"] == "Career Switcher":
        return f"""USER TYPE: Career Switcher

This candidate is transitioning from {tc['from_industry']} / {tc['from_role']} into {tc['to_industry']} / {tc['to_role']}.
They have {tc['years_experience']} years of professional experience.

CRITICAL FRAMING INSTRUCTIONS:
Do not treat the career change as a liability. Reframe it as a strength — external perspective, cross-domain pattern recognition, skills insiders lack.

Reframing principles:
1. Lead with outcomes and capabilities, never with job titles or industry labels
2. Use the TARGET industry's language to describe PAST work
3. Do not highlight what they lack. Silence is better than a defensive disclaimer. NEVER explain the career transition inline within a bullet or summary sentence. Never write "— the same [skill] required for [target role]" or "— directly mirroring [target role] demands." Let the parallel be implicit. If you're explaining the connection, you've already lost.
4. Side projects and coursework in the target field = real experience. Treat them that way.
5. The narrative arc should feel intentional: not fleeing an old career, moving toward something specific.

Tone: Confident. Grounded. Forward-looking. Never apologetic."""

    elif tc["user_type"] == "Mid-Career Professional":
        return f"""USER TYPE: Mid-Career Professional

This candidate has {tc['years_experience']} years of experience in {tc['industry']}.
Current level: {tc['current_level']}. Target level: {tc['target_level']}.
Current role: {tc['current_role']}. Target role: {tc['target_role']}.

FRAMING INSTRUCTIONS:
This person is past proving they can do the job. Focus on ownership, judgment, and impact at scale.

Framing principles:
1. Emphasize ownership: budget managed, team size, revenue influenced
2. Show trajectory and growing scope of responsibility
3. Distinguish decisions from tasks — show decisions made, not tasks completed
4. Frame current achievements at the TARGET level — they are not applying for their current job
5. Quantify everything

Tone: Direct. Confident. Results-focused. No hedging."""

    elif tc["user_type"] == "Student / New Graduate":
        return f"""USER TYPE: Student / New Graduate

This candidate is a {tc['degree']} student / recent graduate from {tc['school']} (GPA: {tc['gpa']}, graduating {tc['grad_year']}).
Target role: {tc['target_role']} in {tc['target_industry']}.

FRAMING INSTRUCTIONS:
Extract maximum signal from what they have: projects, internships, coursework, campus roles, self-directed work.

Framing principles:
1. Projects are real work. Frame them exactly like professional role entries with outcomes.
2. Internship output > internship title. Focus on what was shipped, not where they worked.
3. GPA 3.7 = include it prominently.
4. Frame everything around impact and learning velocity.
5. Hiring at this level is for potential. Show trajectory, not experience.

Tone: Enthusiastic but grounded. Professional without being stiff."""

    return ""


def build_bullets_prompt(tc: dict, jd: dict) -> str:
    user_block = build_user_type_block(tc)
    banned = ", ".join(BANNED_PHRASES)
    return f"""{user_block}

---

You are an elite career strategist and professional writer specializing in resume bullets that make hiring managers stop scanning and start reading.

Your writing standards:
- Every bullet starts with a strong, specific, past-tense action verb. Vary them. Choose verbs that carry weight: Architected, Negotiated, Reduced, Grew, Rebuilt, Launched, Diagnosed, Secured, Automated.
- Quantify every claim that can be quantified. If no number was provided, use relative language ("top 10% of team," "within 3 months of joining") — never leave a vague claim unanchored.
- STAR-lite structure: [Action] + [Context or method] + [Measurable result]. Three components, one sentence.
- Mirror terminology from the target job description naturally.
- No bullet should describe a task. Every bullet should describe an outcome.

Banned phrases (automatic failure if any appear):
{banned}

---

TARGET ROLE CONTEXT:
Role: {jd.get('role_title')}
Seniority: {jd.get('seniority_level')}
Industry: {jd.get('industry')}
What they actually need: {jd.get('implicit_signals', {}).get('what_they_actually_need')}
Must-haves to address: {', '.join(jd.get('must_haves', []))}
Key terminology to mirror: {', '.join(jd.get('key_terminology', []))}
Tone target: {jd.get('tone_target')}

---

CANDIDATE'S PAST ROLE:
Raw input from candidate:
{tc['candidate_raw_input']}

---

TASK:
Write 5 resume bullets for this candidate's most relevant role/experience. Each bullet must:
1. Be directly relevant to the target role above — if the candidate has tangential experience that doesn't map to what this role requires, deprioritize or omit it entirely in favor of experience that does
2. Demonstrate impact, not activity
3. Include at least one specific metric, scale indicator, or relative benchmark
4. Sound like a senior professional in this industry wrote it — not like AI, not like a template

Output format — return ONLY the bullets, one per line, starting with •:
• [Bullet 1]
• [Bullet 2]
• [Bullet 3]
• [Bullet 4]
• [Bullet 5]"""


def build_summary_prompt(tc: dict, jd: dict, bullets: str) -> str:
    user_block = build_user_type_block(tc)
    bullet_lines = [l.strip() for l in bullets.strip().split("\n") if l.strip().startswith("•")]
    top = bullet_lines[0] if len(bullet_lines) > 0 else ""
    second = bullet_lines[1] if len(bullet_lines) > 1 else ""

    return f"""{user_block}

---

Write a professional summary for a resume. This is the most-read section — a hiring manager will spend 10 seconds on it.

Rules:
- 3–4 sentences. 60–90 words total. COUNT THE WORDS BEFORE RETURNING. If over 90, cut until under. This is a hard constraint, not a guideline.
- No "I" statements.
- First sentence: who they are at their highest level — role, years, domain. Specific and non-generic.
- Second sentence: what they are specifically excellent at. Must be specific enough it couldn't describe anyone else.
- Third sentence: forward-looking, connects background to target role explicitly.
- Optional fourth sentence: a real differentiator. Only include if genuine and specific.

Banned phrases: results-driven, passionate professional, proven track record, dynamic, innovative, team player, self-starter, detail-oriented, experienced professional, highly motivated, seeking to leverage, looking to utilize

---

TARGET ROLE:
Role: {jd.get('role_title')}
What they actually need: {jd.get('implicit_signals', {}).get('what_they_actually_need')}
Hiring manager's worry: {jd.get('hiring_manager_worry')}
Tone target: {jd.get('tone_target')}

---

CANDIDATE PROFILE:
User type: {tc['user_type']}
Top bullet (for coherence): {top}
Second bullet: {second}
Raw background: {tc['candidate_raw_input']}

---

Output: Return only the summary text. No label, no explanation."""


def build_validator_prompt(document_type: str, jd: dict, output: str, user_type: str) -> str:
    banned = ", ".join(BANNED_PHRASES)
    return f"""You are a senior hiring manager reviewing AI-generated resume content. Score this output harshly. The bar is: "Would a hiring manager at a top company find this compelling and credible?"

Score each dimension 1–10:

1. SPECIFICITY — Are all claims backed by evidence, metrics, or concrete context?
2. RELEVANCE — Does the content directly address what the target role requires?
3. AUTHENTICITY — Does it sound like a real professional wrote this, not AI?
4. IMPACT — Do the bullets/paragraphs convey meaningful outcomes, not just activities?
5. CLEAN — Is it free of clichés, passive voice, and filler phrases?

Banned phrases (any occurrence = automatic flag):
{banned}

---

CONTEXT:
Document type: {document_type}
Target role: {jd.get('role_title')}
User type: {user_type}
What the role actually needs: {jd.get('implicit_signals', {}).get('what_they_actually_need')}

CONTENT TO REVIEW:
{output}

---

Return ONLY this JSON. No text outside the JSON:

{{
  "scores": {{
    "specificity": 0,
    "relevance": 0,
    "authenticity": 0,
    "impact": 0,
    "clean": 0
  }},
  "overall": 0.0,
  "issues": [
    {{
      "type": "banned_phrase | vague_claim | irrelevant | passive_voice | generic | other",
      "location": "exact quote",
      "fix": "specific suggested replacement"
    }}
  ],
  "verdict": "PASS | REVISE | REJECT",
  "verdict_reason": "one sentence"
}}"""


# ─────────────────────────────────────────────
# RUNNER
# ─────────────────────────────────────────────

def call_claude(prompt: str, model: str = SONNET) -> str:
    message = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def strip_code_fences(text: str) -> str:
    """Strip markdown code fences (```json ... ```) from model output."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


def run_test_case(tc: dict) -> None:
    divider = "─" * 70
    print(f"\n{'═' * 70}")
    print(f"  {tc['id']}: {tc['label']}")
    print(f"{'═' * 70}")

    # Stage 1: JD Parser
    print("\n[1/4] Running JD Parser...")
    jd_raw = call_claude(build_jd_parser_prompt(tc["jd_text"]))
    try:
        jd = json.loads(strip_code_fences(jd_raw))
        print(f"      ✓ Role: {jd.get('role_title')} ({jd.get('seniority_level')})")
        print(f"      ✓ Company type: {jd.get('company_type')}")
        print(f"      ✓ Hiring manager worry: {jd.get('hiring_manager_worry')}")
        print(f"      ✓ What they need: {jd.get('implicit_signals', {}).get('what_they_actually_need')[:100]}...")
    except json.JSONDecodeError:
        print("      ✗ JD Parser returned invalid JSON. Raw output:")
        print(textwrap.indent(jd_raw[:500], "        "))
        jd = {}

    # Stage 2: Bullet Generator
    print(f"\n[2/4] Running Bullet Generator...")
    bullets_raw = call_claude(build_bullets_prompt(tc, jd))
    print(f"\n      OUTPUT — Resume Bullets:")
    print(divider)
    for line in bullets_raw.strip().split("\n"):
        if line.strip():
            print(f"  {line.strip()}")
    print(divider)

    # Stage 3: Summary Generator
    print(f"\n[3/4] Running Summary Generator...")
    summary_raw = call_claude(build_summary_prompt(tc, jd, bullets_raw))
    word_count = len(summary_raw.split())
    print(f"\n      OUTPUT — Professional Summary ({word_count} words):")
    print(divider)
    print(textwrap.fill(summary_raw.strip(), width=68, initial_indent="  ", subsequent_indent="  "))
    print(divider)

    # Stage 4: Validator — Bullets
    print(f"\n[4/4] Running Validator...")
    bullets_score_raw = call_claude(
        build_validator_prompt("bullets", jd, bullets_raw, tc["user_type"]),
        model=HAIKU
    )
    summary_score_raw = call_claude(
        build_validator_prompt("summary", jd, summary_raw, tc["user_type"]),
        model=HAIKU
    )

    def print_scores(label: str, score_raw: str) -> None:
        try:
            result = json.loads(strip_code_fences(score_raw))
            scores = result.get("scores", {})
            overall = result.get("overall", 0)
            verdict = result.get("verdict", "?")
            verdict_reason = result.get("verdict_reason", "")
            issues = result.get("issues", [])

            verdict_icon = "✓" if verdict == "PASS" else ("△" if verdict == "REVISE" else "✗")
            print(f"\n      {label} — {verdict_icon} {verdict} (overall: {overall}/10)")
            print(f"      Specificity: {scores.get('specificity')}/10  "
                  f"Relevance: {scores.get('relevance')}/10  "
                  f"Authenticity: {scores.get('authenticity')}/10  "
                  f"Impact: {scores.get('impact')}/10  "
                  f"Clean: {scores.get('clean')}/10")
            if verdict_reason:
                print(f"      Reason: {verdict_reason}")
            if issues:
                print(f"      Issues ({len(issues)}):")
                for issue in issues[:3]:
                    print(f"        - [{issue.get('type')}] \"{issue.get('location', '')[:60]}\"")
                    print(f"          Fix: {issue.get('fix', '')[:80]}")
        except (json.JSONDecodeError, Exception) as e:
            print(f"      ✗ Validator returned invalid JSON: {e}")
            print(textwrap.indent(score_raw[:300], "        "))

    print_scores("Bullets", bullets_score_raw)
    print_scores("Summary", summary_score_raw)


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set.")
        print("Run: export ANTHROPIC_API_KEY=your_key_here")
        return

    print("Shortlist Prompt Test Runner")
    print(f"Model: {SONNET} (generators) / {HAIKU} (validator)")
    print(f"Running {len(TEST_CASES)} test cases...\n")

    for tc in TEST_CASES:
        run_test_case(tc)

    print(f"\n{'═' * 70}")
    print("  All test cases complete.")
    print(f"{'═' * 70}\n")


if __name__ == "__main__":
    main()
