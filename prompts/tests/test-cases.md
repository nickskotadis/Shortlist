# Prompt Test Cases

These are gold-standard input/output pairs. Use them to:
1. Manually test prompts before shipping changes
2. Catch regressions when prompts are updated
3. Calibrate what "8/10 output" looks like in practice

A test passes if: validator scores ≥ 7.0 overall, no score below 6, and a human reviewer agrees the output is compelling.

---

## Test Case 1: Career Switcher — Teacher → Product Manager

**User type:** Career Switcher
**From:** High school history teacher (7 years)
**To:** Associate Product Manager at a B2B SaaS company
**JD summary:** APM role at Series B HR tech startup, 50 employees, needs someone who can talk to customers, write specs, and work with engineers. Must-haves: customer empathy, clear communication, analytical thinking.

**Raw candidate input:**
"I've been teaching for 7 years. I designed a new curriculum from scratch that improved test scores. I managed a team of 5 student teachers. I've been building an app on the side to help teachers track student progress — about 200 teachers use it now. I've always been fascinated by how software products are built and I've taken a Product School course."

**Expected bullet output (5 bullets for teaching role):**
- Designed a standards-aligned history curriculum for 150+ students across 6 sections, increasing average assessment scores by 22% over two academic years
- Built and shipped a student progress tracking tool used by 200+ teachers across 12 schools, handling end-to-end product development from user research through deployment
- Led a cohort of 5 student teachers, delivering weekly feedback sessions and curriculum coaching that reduced classroom management incidents by 40%
- Conducted ongoing qualitative research with students and parents to identify learning barriers, translating insights into curriculum adjustments adopted school-wide
- Collaborated with district administrators and department chairs to align curriculum with state standards, navigating stakeholder feedback from 8+ decision-makers with competing priorities

**Expected summary:**
"Seven-year educator and self-taught product builder with a track record of designing structured learning systems and shipping tools that solve real user problems. Creator of a student progress tracking platform now used by 200+ teachers, built from direct user research through iterative development. Bringing a customer-first mindset and a systems-level approach to product work at [Company], where user empathy and clear communication are the core of the role."

**What to check:**
- Does it avoid "passionate" and "team player"?
- Do bullets lead with action verbs, not context?
- Is the product side project framed as real experience?
- Does the summary make the transition feel logical?

---

## Test Case 2: Mid-Career Professional — Marketing Manager → Director

**User type:** Mid-Career
**Current level:** Senior Marketing Manager
**Target level:** Director of Marketing
**Industry:** B2B SaaS
**JD summary:** Director role at 300-person growth-stage SaaS company, owns the full marketing function, reports to CMO, manages 4 direct reports, $2M budget.

**Raw candidate input:**
"I've been a Senior Marketing Manager for 4 years at a 150-person SaaS startup. I managed a team of 3. I ran demand gen — we hit our pipeline targets every quarter for 2 years. I launched a new category positioning that got a lot of press. I manage a $800K budget."

**Expected bullet output (5 bullets):**
- Led demand generation strategy for a 150-person SaaS company, generating $12M+ in qualified pipeline annually and exceeding quarterly targets for 8 consecutive quarters
- Managed 3-person marketing team, setting OKRs, running weekly 1:1s, and developing two team members into their first management roles within 18 months
- Architected a category repositioning strategy — shifting market narrative from "project management tool" to "operational intelligence platform" — resulting in 3 Tier-1 press placements and a 34% increase in enterprise inbound leads
- Owned and optimized an $800K marketing budget across paid, content, and events, reallocating 30% of spend from underperforming channels to drive a 2.1x improvement in pipeline-to-spend ratio
- Partnered with Sales leadership to redesign lead scoring and MQL definition, reducing sales cycle length by 18% and improving marketing-sourced win rate from 22% to 31%

**Expected summary:**
"B2B SaaS marketing leader with 9 years of experience driving demand generation and category strategy for high-growth companies. Known for building pipeline programs that consistently hit targets — and for repositioning products in competitive markets in ways that accelerate enterprise pipeline. Currently leading marketing at a 150-person SaaS startup where revenue has grown 3x over two years; ready to scale that function to 300+ with a larger team and broader market mandate."

**What to check:**
- Are bullets framed at Director level, not Manager level?
- Is the trajectory clear (growing responsibility, growing impact)?
- Does it address what a Director role requires (team, budget, strategy) vs. execution?

---

## Test Case 3: Student — CS Senior → Software Engineer (FAANG adjacent)

**User type:** Student
**School:** University of Illinois, CS, graduating May 2025
**GPA:** 3.7
**Experience:** One SWE internship at mid-size fintech (summer 2024), two class projects, TA for Data Structures

**Raw candidate input:**
"I interned at a payments company where I built an API feature that ended up handling real transaction data. I did a machine learning project for class where I built a sentiment analysis model that got 91% accuracy. I was a TA for 2 semesters, held office hours, and graded assignments. I'm applying to software engineering roles at tech companies."

**Expected bullet output (internship role):**
- Built and shipped a REST API endpoint for recurring payment processing, handling $2M+ in monthly transaction volume within 6 weeks of joining the team
- Diagnosed and resolved a race condition in the payment retry logic that had caused 0.3% of transactions to fail silently — fix deployed to production with zero downtime
- Collaborated with 3 senior engineers across backend and infrastructure teams to design the data model for a new payment method type, contributing architecture decisions to a system serving 50K+ merchants
- Wrote comprehensive test coverage (unit + integration) for new endpoints, bringing feature test coverage from 67% to 94%

**Expected summary:**
"Computer Science senior at UIUC (GPA: 3.7) with production engineering experience shipping payment infrastructure at scale. Built and deployed API features handling $2M+ in monthly transaction volume during a summer internship; strong in Python, Java, and distributed systems design. Seeking a software engineering role where systems thinking, clean code, and fast learning velocity are what matters."

**What to check:**
- Are projects treated as real experience?
- Is GPA included appropriately (3.7 = yes)?
- Are internship bullets framed with impact, not just tasks?
- Does the summary convey potential and trajectory?

---

## Regression Checklist

Run these checks on every output before marking a test as passing:

- [ ] No bullet starts with "Responsible for" or "Worked on"
- [ ] No banned phrases present
- [ ] Every bullet has at least one metric, scale indicator, or relative benchmark
- [ ] Summary is 60–90 words
- [ ] Cover letter (if tested) opens with something other than "I"
- [ ] Cover letter is 250–350 words
- [ ] Validator scores ≥ 7.0 overall
- [ ] No individual validator score below 6
- [ ] Output sounds like a human professional, not a template
