# User Type: Career Switcher

**Inject into:** All generator prompts (bullets, summary, cover letter)
**Priority:** Primary segment — this injection block is the most important to get right

---

## Injection Block

```
USER TYPE: Career Switcher

This candidate is transitioning from {{FROM_INDUSTRY}} / {{FROM_ROLE}} into {{TO_INDUSTRY}} / {{TO_ROLE}}.
They have {{YEARS_EXPERIENCE}} years of professional experience.

CRITICAL FRAMING INSTRUCTIONS:
Do not treat this as a liability. A career switcher brings external perspective, cross-domain pattern recognition, and skills that pure insiders often lack. Your job is to make that case compellingly — not to apologize for the gap.

Reframing principles:
1. Lead with outcomes and capabilities, never with job titles or industry labels
2. Every skill transfers — identify the bridge: analytics is analytics, stakeholder management is stakeholder management, systems thinking crosses every domain
3. Use the TARGET industry's language to describe PAST work. If they managed a restaurant and are targeting operations roles, they "optimized throughput for a high-volume service environment" — not "managed a restaurant"
4. Do not highlight what they lack. Silence is better than a defensive disclaimer. NEVER explain the career transition inline within a bullet or summary sentence. Never write "— the same [skill] required for [target role]" or "— directly mirroring [target role] demands." Let the parallel be implicit. If you're explaining the connection, you've already lost.
5. If they have completed any relevant coursework, certifications, projects, or volunteer work in the target field — treat this as real, legitimate experience. It is.
6. The narrative arc should feel intentional: they are not fleeing their old career, they are moving toward something specific. The cover letter especially should make this feel like a deliberate, well-reasoned move.

Tone: Confident. Grounded. Forward-looking. Never apologetic.
```

---

## Variables Required

| Variable | Description | Example |
|---|---|---|
| `{{FROM_INDUSTRY}}` | Industry they're leaving | "Hospitality" |
| `{{FROM_ROLE}}` | Their current/most recent role title | "Restaurant Operations Manager" |
| `{{TO_INDUSTRY}}` | Industry they're targeting | "Tech" |
| `{{TO_ROLE}}` | Target role title | "Operations Manager" |
| `{{YEARS_EXPERIENCE}}` | Total professional years | "7" |

---

## Skill Bridge Reference

Use this to identify transferable skills when generating content. Expand this list as new user cases emerge.

| From Role/Industry | Transferable To | Bridge Framing |
|---|---|---|
| Military officer | Any management role | "Led cross-functional teams under high-stakes conditions, managed logistics and resource allocation for [X] personnel" |
| Teacher / Educator | Training, L&D, Product, UX | "Designed curriculum for diverse learners, measured outcomes, iterated on delivery based on data" |
| Restaurant / Hospitality | Operations, HR, Customer Success | "Managed high-velocity service operations, reduced costs while maintaining quality, trained and retained staff in a high-churn environment" |
| Lawyer | Strategy, Consulting, Product, BD | "Synthesized complex information, managed high-stakes stakeholder relationships, produced client-facing deliverables under deadline pressure" |
| Nurse / Healthcare | PM, UX Research, Operations | "Managed patient workflows under resource constraints, documented outcomes, collaborated across multidisciplinary teams" |
| Journalist | Content, Comms, Marketing, Research | "Produced high-quality written work under deadline, conducted primary research, distilled complex topics for non-expert audiences" |
| Financial Analyst | Product, Strategy, Data, Consulting | "Built models to support strategic decisions, synthesized large datasets into executive recommendations, owned quantitative deliverables end-to-end" |
