# Shortlist Prompt Engineering System

This directory contains the full prompt architecture for Shortlist. These prompts are the core IP of the product. Treat them like production code — version controlled, tested, and reviewed on every change.

## Pipeline Overview

Every generation runs through 4 stages:

```
[1] JD Parser       → Extracts structured signals from the job description
[2] User Profiler   → Maps user input to persona + writing style parameters
[3] Generator       → Produces the document (bullets / summary / cover letter)
[4] Validator       → Scores output against quality guardrails before delivery
```

## Directory Structure

```
prompts/
├── parsers/
│   └── jd-parser.md          # Stage 1: Extract structured data from job description
├── user-types/
│   ├── career-switcher.md    # Injection block for career changers
│   ├── mid-career.md         # Injection block for experienced professionals
│   ├── student.md            # Injection block for students / new grads
│   └── executive.md          # Injection block for senior leaders
├── generators/
│   ├── bullets.md            # Resume bullet generator
│   ├── summary.md            # Professional summary generator
│   └── cover-letter.md       # Cover letter generator
├── validators/
│   └── quality-check.md      # Output quality scorer
└── tests/
    └── test-cases.md         # Gold-standard input/output pairs for regression testing
```

## Variable Convention

All injection points use `{{VARIABLE_NAME}}` syntax. When translating to code, these become template string interpolations.

## Quality Bar

An output passes if it scores 7+ overall and no individual dimension scores below 6 on the quality validator. Anything below that gets regenerated automatically (up to 2 retries) before delivery to the user.

## Banned Phrases

The following phrases are hard-blocked across all outputs. If they appear in generated content, it is a prompt failure:

- results-driven, results-oriented
- passionate about / passionate professional
- team player
- proven track record
- self-starter
- detail-oriented
- hard-working, hardworking
- go-getter
- synergy, synergize
- leverage (as a verb)
- utilize (use "use")
- dynamic professional
- innovative / innovator / innovation-focused
- visionary
- thought leader
- best-in-class
- fast-paced environment
- was responsible for
- helped with / assisted in / worked on (without specifics)
- I am writing to apply for
- I would be a great fit
- Please find my resume attached
- Thank you for your time and consideration
- To whom it may concern
