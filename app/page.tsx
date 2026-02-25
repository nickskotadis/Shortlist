import Link from "next/link";

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

const exampleBullets = [
  "Architected a student progress tracking app adopted by 200+ teachers across 3 districts, owning the full product cycle from discovery interviews through iterative feature releases.",
  "Diagnosed friction points in student performance data through structured observation and weekly user feedback sessions, converting findings into a prioritized spec that shipped 4 improvements in one semester.",
  "Rebuilt a school-wide scheduling system for 500 families and 30 staff by consolidating input from competing stakeholders into a single structured workflow, eliminating recurring coordination failures.",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900 tracking-tight">
            Shortlist
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/generate"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Try it free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block"></span>
          Built for career switchers, students, professionals &amp; executives
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
          Application materials that<br />
          <span className="text-indigo-600">actually sound like you.</span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Paste a job description. Describe your background in plain language. Get
          resume bullets, a professional summary, and a cover letter — specific to
          the role, your level, and your industry.
        </p>

        <Link
          href="/generate"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors shadow-sm"
        >
          Generate for free
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="mt-4 text-sm text-slate-400">No account required to start</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-slate-50 rounded-2xl p-7 border border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example output */}
      <section className="max-w-3xl mx-auto px-6 pb-28 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">What good looks like</h2>
        <p className="text-slate-500 mb-10 text-sm">
          Shortlist output for a teacher transitioning into product management — no templates, no AI filler.
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-left shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
            Resume bullets — Associate PM, B2B SaaS
          </p>
          <ul className="space-y-4">
            {exampleBullets.map((bullet, i) => (
              <li key={i} className="flex gap-3 text-slate-700 text-sm leading-relaxed">
                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to get shortlisted?</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Paste your first job description and see what role-specific output looks like.
        </p>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors"
        >
          Start generating
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </div>
  );
}
