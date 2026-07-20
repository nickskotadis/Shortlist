import Link from "next/link";
import Nav from "@/components/Nav";

const features = [
  {
    title: "Reads the job description",
    body: "Extracts what the role actually needs — not just keywords, but the implicit signals most candidates miss.",
  },
  {
    title: "Adapts to who you are",
    body: "Career switcher, student, mid-career, or executive. The framing, tone, and evidence strategy changes for each.",
  },
  {
    title: "Output that doesn't sound like AI",
    body: "Every bullet starts from your real experience. No templates. No \"results-driven professional.\" No filler.",
  },
];

// Sample output for the typeset document (teacher → PM). The first bullet's
// opening claim is flagged in the margin to show the hallucination check.
const sampleDimensions = [
  { label: "Specificity", score: 9 },
  { label: "Relevance", score: 8 },
  { label: "Authenticity", score: 9 },
  { label: "Impact", score: 8 },
];

const CTA_CLASS =
  "inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] font-semibold px-8 py-4 rounded-md text-base transition-colors";

function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <Nav />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="animate-fade-up">
          <p className="label-editorial mb-7">
            For career switchers, students, professionals &amp; executives
          </p>
        </div>

        <div className="animate-fade-up animate-delay-1">
          <h1 className="display-xl text-[var(--color-ink)] mb-6">
            Application materials<br />
            that get you <em className="italic">shortlisted.</em>
          </h1>
        </div>

        <div className="animate-fade-up animate-delay-2">
          <p className="text-lg text-[var(--color-ink-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Paste a job description. Describe your background in plain language. Get
            resume bullets, a professional summary, and a cover letter — specific to
            the role, your level, and your industry.
          </p>
        </div>

        <div className="animate-fade-up animate-delay-3">
          <Link href="/generate" className={CTA_CLASS}>
            Generate for free
            <Arrow />
          </Link>
          <p className="mt-4 text-sm text-[var(--color-ink-tertiary)]">No account required to start</p>
        </div>
      </section>

      {/* Centerpiece — a typeset output sample with quality score + a flagged claim */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <p className="label-editorial mb-2">What good looks like</p>
          <h2 className="display-m text-[var(--color-ink)]">
            A teacher, rewritten for product management.
          </h2>
        </div>

        <div className="animate-fade-up grid md:grid-cols-[1fr_270px] bg-[var(--color-surface)] border border-[var(--color-rule)] rounded-md shadow-sm shadow-[var(--color-shadow)] overflow-hidden">
          {/* Document body */}
          <article className="p-8 sm:p-10 md:border-r border-[var(--color-rule)]">
            <p className="label-editorial mb-1.5">Résumé bullets</p>
            <h3 className="font-serif text-xl text-[var(--color-ink)] mb-7">Associate PM · B2B SaaS</h3>
            <ul className="space-y-5 font-mono text-[0.9rem] leading-relaxed text-[var(--color-ink)]">
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] shrink-0">—</span>
                <span>
                  Architected a{" "}
                  <span className="underline decoration-dotted decoration-[var(--color-warning)] underline-offset-4">
                    student progress tracking app adopted by 200+ teachers across 3 districts
                  </span>
                  , owning the full product cycle from discovery interviews through iterative feature releases.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] shrink-0">—</span>
                <span>
                  Diagnosed friction points in student performance data through structured observation and weekly
                  user feedback sessions, converting findings into a prioritized spec that shipped 4 improvements in
                  one semester.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] shrink-0">—</span>
                <span>
                  Rebuilt a school-wide scheduling system for 500 families and 30 staff by consolidating input from
                  competing stakeholders into a single structured workflow, eliminating recurring coordination failures.
                </span>
              </li>
            </ul>
          </article>

          {/* Marginalia — quality score + hallucination flag */}
          <aside className="p-6 sm:p-8 bg-[var(--color-inset)] flex flex-col gap-6">
            <div>
              <p className="label-editorial mb-2">Quality</p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-5xl leading-none text-[var(--color-accent)]">8.7</span>
                <span className="text-sm text-[var(--color-ink-tertiary)]">/ 10</span>
              </div>
              <p className="text-xs text-[var(--color-ink-tertiary)] mt-1">Passed quality check · Strong</p>
              <div className="mt-4 space-y-2">
                {sampleDimensions.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--color-ink-tertiary)] w-20 shrink-0">{d.label}</span>
                    <span className="flex-1 h-px bg-[var(--color-rule-strong)] relative">
                      <span
                        className="absolute inset-y-0 left-0 h-px bg-[var(--color-accent)]"
                        style={{ width: `${d.score * 10}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--color-rule)] pt-5">
              <p className="label-editorial mb-2" style={{ color: "var(--color-warning)" }}>
                ⚑ Verify before submitting
              </p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-secondary)]">
                Confirm{" "}
                <span className="font-mono text-[var(--color-warning)]">&ldquo;200+ teachers across 3 districts&rdquo;</span>{" "}
                — the model flags every metric it can&rsquo;t source from your input, so nothing gets fabricated.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Features — hairline-ruled, not cards */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 border-y border-[var(--color-rule)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-rule)]">
          {features.map((f) => (
            <div key={f.title} className="px-6 py-8 md:first:pl-0 md:last:pr-0">
              <h3 className="font-serif text-lg text-[var(--color-ink)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--color-ink-secondary)] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center border-t border-[var(--color-rule)]">
        <h2 className="display-l text-[var(--color-ink)] mb-4">Ready to get shortlisted?</h2>
        <p className="text-[var(--color-ink-secondary)] mb-8 max-w-md mx-auto">
          Paste your first job description and see what role-specific output looks like.
        </p>
        <Link href="/generate" className={CTA_CLASS}>
          Start generating
          <Arrow />
        </Link>
      </section>
    </div>
  );
}
