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

const exampleBullets = [
  "Architected a student progress tracking app adopted by 200+ teachers across 3 districts, owning the full product cycle from discovery interviews through iterative feature releases.",
  "Diagnosed friction points in student performance data through structured observation and weekly user feedback sessions, converting findings into a prioritized spec that shipped 4 improvements in one semester.",
  "Rebuilt a school-wide scheduling system for 500 families and 30 staff by consolidating input from competing stakeholders into a single structured workflow, eliminating recurring coordination failures.",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090C18]">
      <Nav maxWidth="max-w-6xl" />

      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-6 pt-28 pb-24 text-center overflow-hidden">
        {/* Radial glow behind headline */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="animate-fade-up relative">
          <div className="inline-flex items-center gap-2 bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            Built for career switchers, students, professionals &amp; executives
          </div>
        </div>

        <div className="animate-fade-up animate-delay-1">
          <h1 className="text-5xl sm:text-6xl font-bold text-[#EEEEFC] tracking-tight leading-[1.1] mb-6">
            Application materials<br />
            that get you{" "}
            <span className="text-gradient">shortlisted.</span>
          </h1>
        </div>

        <div className="animate-fade-up animate-delay-2">
          <p className="text-lg text-[#8888A8] max-w-2xl mx-auto mb-10 leading-relaxed">
            Paste a job description. Describe your background in plain language. Get
            resume bullets, a professional summary, and a cover letter — specific to
            the role, your level, and your industry.
          </p>
        </div>

        <div className="animate-fade-up animate-delay-3">
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/25 hover:-translate-y-0.5"
          >
            Generate for free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-[#4A4A68]">No account required to start</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="animate-fade-up bg-[#0D1122] rounded-2xl p-7 border border-[#232548] hover:border-[#2E3165] transition-colors"
              style={{ animationDelay: `${0.1 + i * 0.07}s`, opacity: 0 }}
            >
              <h3 className="text-sm font-semibold text-[#EEEEFC] mb-2">{f.title}</h3>
              <p className="text-sm text-[#8888A8] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example output */}
      <section className="max-w-3xl mx-auto px-6 pb-28 text-center">
        <h2 className="text-2xl font-bold text-[#EEEEFC] mb-3">What good looks like</h2>
        <p className="text-[#8888A8] mb-10 text-sm">
          Shortlist output for a teacher transitioning into product management — no templates, no AI filler.
        </p>
        <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-8 text-left">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wider">
              Resume bullets — Associate PM, B2B SaaS
            </p>
          </div>
          <ul className="space-y-4">
            {exampleBullets.map((bullet, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                <span className="text-[#C8C8F0]">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24 px-6 text-center border-t border-[#232548]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-[#090C18] to-[#090C18] pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-[#EEEEFC] mb-4">Ready to get shortlisted?</h2>
          <p className="text-[#8888A8] mb-8 max-w-md mx-auto">
            Paste your first job description and see what role-specific output looks like.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5"
          >
            Start generating
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
