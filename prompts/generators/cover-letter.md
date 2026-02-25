# Cover Letter Generator

**Stage:** 3 of 4
**Input:** User context + JD analysis + user type injection + generated bullets + summary
**Output:** 250–350 word cover letter, 4 paragraphs
**Model:** Claude Sonnet (highest quality — this is the most human-sounding document)

---

## Full Prompt

```
{{USER_TYPE_INJECTION_BLOCK}}

---

You are writing a cover letter. This is not a template. It is a specific, personal letter from a real person to a real hiring manager at a real company. It must read that way.

The worst cover letters:
- Start with "I am writing to express my interest in..."
- Summarize the resume ("As you can see from my resume...")
- Use generic company praise ("I have long admired your innovative culture...")
- End with "I look forward to hearing from you" and "Thank you for your time and consideration"
- Are indistinguishable from 500 other letters for the same role

The best cover letters:
- Open with something that makes the hiring manager think "this person gets it"
- Make the most relevant experience feel inevitable — of course this person should be considered
- Demonstrate genuine company knowledge that signals the candidate did real homework
- Close with confidence, not desperation

---

STRUCTURE (follow exactly):

Paragraph 1 — The Hook (2–3 sentences)
Do NOT start with "I." Do NOT start with the candidate's name. Do NOT use a generic opener.
Start with an insight about the company's challenge, market position, or the problem this role solves. Then introduce the candidate in relation to that problem. Make the hiring manager feel like this letter was written specifically for them.

Paragraph 2 — The Evidence (3–4 sentences)
Pick the 1–2 most relevant achievements from the candidate's background and make the connection to this specific role explicit. Be specific — include at least one metric. This paragraph should answer the hiring manager's core worry: {{JD_HIRING_MANAGER_WORRY}}.

Paragraph 3 — Why This Company (3–4 sentences)
This paragraph must be specific to this company. Not "I admire your values." Not "I'm excited about your growth." Use what we know from the JD analysis: the company type, industry context, implicit signals, what they actually need. If the JD reveals something about where the company is going, reference it. This paragraph separates candidates who did their homework from those who didn't.

Paragraph 4 — The Close (2 sentences)
Confident. Not "I hope to hear from you." Express genuine interest and forward momentum. Suggest the conversation you want to have. Don't beg.

---

RULES:
- Total length: 250–350 words. Hard limit.
- Tone must match: {{JD_TONE_TARGET}}
  - startup-casual: direct, a little informal, energetic
  - professional: measured, clear, no filler
  - formal: precise, complete sentences, no contractions
  - technical: specific, capability-focused, less personality
  - creative: voice-forward, specific, distinct
- No clichés from the banned list
- No passive voice
- Every sentence must earn its place — if it could be cut without losing meaning, cut it

---

TARGET ROLE CONTEXT:
Company type: {{JD_COMPANY_TYPE}}
Role: {{JD_ROLE_TITLE}}
What they actually need: {{JD_WHAT_THEY_ACTUALLY_NEED}}
Hiring manager's core worry: {{JD_HIRING_MANAGER_WORRY}}
Culture signals: {{JD_CULTURE_SIGNALS}}
Key terminology: {{JD_KEY_TERMINOLOGY}}
Tone target: {{JD_TONE_TARGET}}

---

CANDIDATE PROFILE:
User type: {{USER_TYPE}}
Name: {{CANDIDATE_NAME}}
Current/most recent title: {{CURRENT_ROLE}}
Target role: {{TARGET_ROLE}}
Top 2 achievements (to draw from):
1. {{TOP_BULLET}}
2. {{SECOND_BULLET}}
Additional context the candidate provided: {{CANDIDATE_ADDITIONAL_NOTES}}

---

TASK:
Write the cover letter. Return only the letter text — no subject line, no date, no address block. Start directly with the first paragraph.
```

---

## Notes

- `{{CANDIDATE_ADDITIONAL_NOTES}}` is a freeform field in the UI: "Anything specific you want us to include? (e.g., personal connection to the company, a specific project you want to highlight, a reason for the move)". This is the field that unlocks the most personalization. Make it prominent in the UI.
- The "Why This Company" paragraph is the hardest to generate well with only JD data. In V2, consider adding a company research field where users can paste a paragraph about why they want this role specifically.
- Cover letters for career switchers: Paragraph 1 should reframe the transition as the *reason* they're a strong candidate, not something to be explained away.
- Cover letters for executives: More strategic framing in P1, more emphasis on stakeholder relationships and org transformation in P2, more external company knowledge in P3.

## Strong vs. Weak Opening Examples

**Weak (never generate these):**
- "I am writing to express my interest in the Senior Product Manager role at Acme Corp."
- "I came across your job posting and was immediately excited by the opportunity."
- "With over 8 years of experience in product management, I believe I would be an excellent fit."

**Strong (study these patterns):**
- "Acme Corp's shift toward enterprise customers in Q3 created a product challenge that most PM teams underestimate: the gap between what enterprise buyers need and what self-serve products actually deliver. It's a gap I've spent the last four years closing at [Company]."
- "Most logistics companies optimize for cost or speed. [Company]'s decision to optimize for both — while building the data infrastructure to do it profitably — is the kind of systems-level challenge that drew me to operations engineering in the first place."
- "The jump from 50 to 500 engineers breaks most engineering cultures. I've seen it happen, and I've spent my career building the processes that prevent it."
