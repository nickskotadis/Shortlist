# User Type: Executive

**Inject into:** All generator prompts (bullets, summary, cover letter)
**Target:** 15+ years experience, VP / C-suite / Board-level roles

---

## Injection Block

```
USER TYPE: Executive

This candidate is targeting {{TARGET_ROLE}} roles. They have {{YEARS_EXPERIENCE}} years of experience.
Most recent role: {{MOST_RECENT_ROLE}} at {{MOST_RECENT_COMPANY_TYPE}}.

FRAMING INSTRUCTIONS:
At the executive level, the writing is not about job duties or even achievements — it is about narrative, positioning, and market presence. Hiring committees at this level are asking: "Is this person credible in a boardroom? Can they represent us externally? Have they done this at the scale we need?"

Framing principles:
1. P&L, org size, and market scope are the primary signals. If they've managed $50M in revenue, that number belongs in the first 30 words of the summary.
2. Every bullet is a strategic narrative, not a task list. The structure is: situation → decision → outcome → scale.
3. External visibility matters: board participation, speaking engagements, published work, industry recognition. Include these.
4. Use precise, authoritative language. Eliminate anything that sounds defensive, tentative, or explanatory.
5. Avoid over-stuffing with accomplishments — selectivity signals confidence. 3 outstanding bullets beat 8 mediocre ones.
6. The summary is the most critical section. It must answer in 4 sentences: who they are at the highest level, what they're known for, what they've built or transformed, and where they're going.
7. Cover letters at this level are rare and must be exceptional — they are personal, strategic, and demonstrate that the candidate has done real diligence on the company.

Tone: Authoritative. Strategic. Precise. Never braggy — let the numbers speak.
```

---

## Variables Required

| Variable | Description | Example |
|---|---|---|
| `{{TARGET_ROLE}}` | Executive role type | "Chief Operating Officer" |
| `{{YEARS_EXPERIENCE}}` | Total career years | "22" |
| `{{MOST_RECENT_ROLE}}` | Most recent title | "SVP of Operations" |
| `{{MOST_RECENT_COMPANY_TYPE}}` | Company context | "Series D logistics startup (500 employees)" |

---

## Executive Bullet Formula

Standard bullets don't work at this level. Use this structure:

**[Strategic action verb] + [scope/context] + [specific decision or approach] + [measurable outcome at scale]**

Example:
- Weak: "Led company-wide digital transformation initiative"
- Strong: "Architected a 3-year digital transformation roadmap for a $1.2B division, consolidating 14 legacy systems into a unified platform and reducing operational costs by $18M annually"

## Executive Summary Formula

Line 1: Title, years, domain, and scale
Line 2: What they are known for — the specific capability that makes them sought-after
Line 3: The biggest thing they've built, fixed, or transformed — with numbers
Line 4 (optional): The strategic thesis that drives how they operate — their POV on the field
