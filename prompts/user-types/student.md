# User Type: Student / New Graduate

**Inject into:** All generator prompts (bullets, summary, cover letter)
**Target:** 0–2 years experience, internships, campus roles, projects

---

## Injection Block

```
USER TYPE: Student / New Graduate

This candidate is a {{DEGREE_TYPE}} student / recent graduate in {{FIELD_OF_STUDY}} from {{SCHOOL}}.
Graduation: {{GRAD_YEAR}}. Target role: {{TARGET_ROLE}} in {{TARGET_INDUSTRY}}.
Relevant experience: internships, campus roles, projects, coursework.

FRAMING INSTRUCTIONS:
The absence of full-time experience is not a weakness to apologize for — it is simply a different evidence base. Your job is to extract maximum signal from what they do have: projects, internships, coursework, campus leadership, extracurriculars, and self-directed work.

Framing principles:
1. Projects are real work. A capstone project that achieved measurable results is as valid as a job. Frame it exactly like a professional role entry.
2. Internship output > internship title. "Marketing Intern" is meaningless. "Built the company's first automated reporting dashboard, reducing analyst time by 4 hours/week" is not.
3. GPA and academic achievements belong if they're strong (3.5+) or relevant to the role. Don't include weak GPA — omit it rather than defend it.
4. Campus leadership translates directly: Club President = "managed a team of 12 and a $15K annual budget." Make that translation explicit.
5. Coursework is evidence only when directly relevant and recent. List it as "Relevant coursework" with specific course names — not a generic "studied business."
6. Frame everything around impact and learning velocity: what did they accomplish, and how fast did they learn? Hiring managers at this level are hiring for potential, not experience.
7. Enthusiasm and trajectory matter here more than any other user type. The cover letter should convey genuine motivation without sounding desperate or generic.

Tone: Enthusiastic but grounded. Professional without being stiff. Forward-looking.
```

---

## Variables Required

| Variable | Description | Example |
|---|---|---|
| `{{DEGREE_TYPE}}` | Degree level | "Bachelor's" |
| `{{FIELD_OF_STUDY}}` | Major/field | "Computer Science" |
| `{{SCHOOL}}` | Institution name | "University of Michigan" |
| `{{GRAD_YEAR}}` | Graduation year | "2025" |
| `{{TARGET_ROLE}}` | Role they're applying for | "Software Engineer" |
| `{{TARGET_INDUSTRY}}` | Target industry | "Tech" |

---

## Experience Translation Guide

| What They Have | How to Frame It |
|---|---|
| Class project | "Developed [X] using [tech], achieving [outcome/metric]" |
| Internship | Treat as a real role entry with bullets focused on output |
| Club officer role | "Led [team size], managed [budget], delivered [outcome]" |
| Freelance / side work | Treat as real client work with deliverables and outcomes |
| Research assistant | "Contributed to [research area], responsibilities included [specific tasks], findings [published/presented/applied]" |
| Part-time job (unrelated) | Only include if it demonstrates transferable skills (customer communication, team management, reliability under pressure) |
| Bootcamp / certification | List under education or a "Skills & Certifications" section — treat as legitimate training |
