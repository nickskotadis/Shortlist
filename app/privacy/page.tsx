import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Shortlist",
  description: "Privacy policy for Shortlist and the Shortlist Chrome extension.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold text-slate-900 tracking-tight">
            Shortlist
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-500">Privacy Policy</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 space-y-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Privacy Policy</h1>
            <p className="text-sm text-slate-500">Last updated: March 2026</p>
          </div>

          <Section title="Overview">
            <p>
              Shortlist (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is an AI-powered
              career writing tool that helps you create tailored resumes, cover letters, and
              LinkedIn profiles. This policy explains what data we collect, how we use it, and your
              rights.
            </p>
          </Section>

          <Section title="Web Application">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Data we collect</h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
              <li>
                <strong>Account information</strong> — your email address, used for authentication
                via magic link (no password stored).
              </li>
              <li>
                <strong>Resume and career content</strong> — text you enter into the app (resume,
                job descriptions) to generate tailored documents. This content is sent to
                Anthropic&rsquo;s Claude API to produce your output and is saved to your account
                for your own reference.
              </li>
              <li>
                <strong>Generated documents</strong> — the outputs we produce for you, stored so
                you can access them from your dashboard.
              </li>
              <li>
                <strong>Usage metadata</strong> — generation counts, document types, quality
                scores, and anonymous performance metrics. We never store resume text or job
                descriptions in analytics systems.
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">How we use it</h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
              <li>To generate and deliver your tailored career documents.</li>
              <li>To maintain your account and generation history.</li>
              <li>To process subscription payments via Stripe.</li>
              <li>To improve output quality through aggregate, anonymised metrics.</li>
            </ul>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">Third-party services</h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
              <li>
                <strong>Anthropic</strong> — your input text is sent to Claude to generate output.
                See{" "}
                <a
                  href="https://www.anthropic.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Anthropic&rsquo;s privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Supabase</strong> — authentication and database hosting. Data is stored in
                the US.
              </li>
              <li>
                <strong>Stripe</strong> — payment processing. We never store card details.
              </li>
              <li>
                <strong>PostHog</strong> — anonymous product analytics (no content fields).
              </li>
              <li>
                <strong>Sentry</strong> — error monitoring. PII is not sent to Sentry.
              </li>
            </ul>
          </Section>

          <Section title="Chrome Extension">
            <p className="mb-3">
              The Shortlist Chrome extension adds a &ldquo;Shortlist this job&rdquo; button to
              supported job board pages (Greenhouse, Lever, Workday, Indeed, LinkedIn).
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mb-2">What the extension does</h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
              <li>
                Reads the job description text from the current job posting page when you click the
                button.
              </li>
              <li>
                Passes that text to{" "}
                <strong>shortlist-amber.vercel.app/generate</strong> as a URL parameter so it
                pre-fills the job description field.
              </li>
              <li>Opens the Shortlist app in a new tab.</li>
            </ul>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">
              What the extension does NOT do
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
              <li>
                <strong>Does not store any data</strong> — the extension has no backend and writes
                nothing to local storage or any server.
              </li>
              <li>Does not read any page content unless you click the button.</li>
              <li>Does not track your browsing history or any other page data.</li>
              <li>Does not collect personal information.</li>
            </ul>

            <p className="mt-3 text-sm text-slate-600">
              Once you click the button, data handling is governed by the Shortlist web application
              privacy policy above.
            </p>
          </Section>

          <Section title="Data retention & deletion">
            <p>
              You can delete your account and all associated data at any time by emailing us (see
              contact below). We will permanently delete your data within 30 days of a valid
              deletion request.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a single authentication cookie managed by Supabase to keep you logged in. We
              do not use advertising or tracking cookies.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. The &ldquo;last updated&rdquo; date at
              the top will reflect any changes. Continued use of Shortlist after changes constitutes
              acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Email{" "}
              <a
                href="mailto:nick@getshortlist.io"
                className="text-indigo-600 hover:underline"
              >
                nick@getshortlist.io
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">
        {title}
      </h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
