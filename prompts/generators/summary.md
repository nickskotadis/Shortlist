# Professional Summary Generator

**Stage:** 3 of 4 (runs after bullets are generated)
**Input:** User context + JD analysis + user type injection + generated bullets
**Output:** 3–4 sentence professional summary (60–90 words)
**Model:** Claude Sonnet

---

## Full Prompt

```
{{USER_TYPE_INJECTION_BLOCK}}

---

You are writing the professional summary for a resume. This is the most-read section of any resume — a hiring manager will spend 10 seconds on it and decide whether to continue. It must earn every word.

Rules:
- 3–4 sentences. 60–90 words total. COUNT THE WORDS BEFORE RETURNING. If over 90, cut until under. This is a hard constraint, not a guideline.
- No "I" statements. Written in implied third person (no subject at all, or "[Name] is a...")
- First sentence: who they are at their highest level — role, years, domain. Make it specific and non-generic.
- Second sentence: what they are specifically excellent at — the capability or pattern of impact that defines their professional identity. Must be specific enough that it couldn't describe anyone else.
- Third sentence: a forward-looking statement that connects their background to the target role. Make the bridge explicit.
- Optional fourth sentence: a differentiator — something that makes them genuinely unusual. Only include if it's real and specific.
- Sound like a human professional wrote this about themselves, not like a template.

Banned phrases (automatic failure):
results-driven, passionate professional, proven track record, dynamic, innovative, team player, self-starter, detail-oriented, experienced professional, seasoned veteran, highly motivated, seeking to leverage, looking to utilize

---

TARGET ROLE CONTEXT:
Role: {{JD_ROLE_TITLE}}
What they actually need: {{JD_WHAT_THEY_ACTUALLY_NEED}}
Hiring manager's core worry: {{JD_HIRING_MANAGER_WORRY}}
Key terminology: {{JD_KEY_TERMINOLOGY}}
Tone target: {{JD_TONE_TARGET}}

---

CANDIDATE PROFILE:
User type: {{USER_TYPE}}
Current/most recent title: {{CURRENT_ROLE}}
Years of experience: {{YEARS_EXPERIENCE}}
Industry background: {{INDUSTRY_BACKGROUND}}
Top achievement (from generated bullets): {{TOP_BULLET}}
Second strongest signal: {{SECOND_BULLET}}

---

TASK:
Write the professional summary. Address the hiring manager's core worry implicitly — don't name it directly, but write a summary that would make a hiring manager think "this person can solve exactly the problem we have."

Output: Return only the summary text. No label, no explanation.
```

---

## Notes

- This prompt runs *after* the bullet generator. The `{{TOP_BULLET}}` and `{{SECOND_BULLET}}` inputs are pulled from the highest-scoring bullets to create coherence between the summary and the role content.
- The summary should feel like a preview of the resume, not a separate document. Key phrases should echo (not copy) what appears in the bullets.
- For career switchers: the third sentence (bridge) is the most important. It must make the transition feel logical and intentional.
- For executives: the summary is 4 sentences and the optional differentiator is mandatory — something about scale, external recognition, or a distinctive point of view.

## Format Variants by User Type

**Student:**
> [Name] is a [degree] candidate in [field] with hands-on experience in [specific capability from projects/internships]. [Specific achievement from strongest project/internship, with metric]. Currently seeking [target role] where [specific value they bring] can [specific outcome for employer].

**Career Switcher:**
> [X] years of experience in [from-industry] specializing in [transferable core skill]. [Achievement that demonstrates this skill at its highest level, with metric]. Now transitioning into [to-industry] to [specific goal], bringing [the cross-domain value that's genuinely useful].

**Mid-Career:**
> [Title]-level [function] professional with [X] years driving [specific type of outcome] in [industry context]. Known for [specific capability pattern — the thing colleagues always come to them for]. Most recently [most impactful recent achievement, with metric].

**Executive:**
> [Function] executive with [X]+ years building and scaling [type of org/function] across [relevant context — industry, company stage, etc.]. Known for [distinctive strategic capability]. Most recently led [major transformation/initiative] at [company context], resulting in [outcome at scale]. [Optional: POV sentence that establishes a perspective on the field.]
