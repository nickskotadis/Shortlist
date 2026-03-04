"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";

const MONTHLY_PRICE_CENTS = 700;  // $7.00/mo
const ANNUAL_PRICE_CENTS = 6300;  // $63.00/yr ($5.25/mo, 3 months free)

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const FREE_FEATURES = [
  "2 generations per month",
  "Resume bullets, summary & cover letter",
  "LinkedIn About & Headline",
  "JD analysis + keyword tailoring",
  "Quality score + keyword gap on every output",
  "DOCX & PDF export",
  "Resume health score (1×)",
  "Interview prep questions",
];

const PRO_FEATURES = [
  "Unlimited generations",
  "Full application package — bullets, cover letter & LinkedIn at once (ZIP export)",
  "AI Answer Coach — practice answers with scored feedback",
  "LinkedIn About & Headline",
  "JD analysis + keyword tailoring",
  "Quality score + keyword gap on every output",
  "DOCX & PDF export",
  "Unlimited resume health scores",
  "Interview prep questions",
  "Priority support",
];

export default function PricingPage() {
  const posthog = usePostHog();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUpgrade = async () => {
    posthog?.capture("upgrade_clicked", { billing_period: billing, source: "pricing_page" });
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPeriod: billing }),
      });

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (cents: number) => {
    const n = cents / 100;
    return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
  };

  const monthlyDisplay =
    billing === "monthly"
      ? fmt(MONTHLY_PRICE_CENTS)
      : fmt(Math.round(ANNUAL_PRICE_CENTS / 12));

  const annualSavings = MONTHLY_PRICE_CENTS * 12 - ANNUAL_PRICE_CENTS;

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      {/* Nav */}
      <nav className="bg-[var(--color-nav-bg)] backdrop-blur-xl border-b border-[var(--color-border-subtle)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight hover:text-indigo-400 transition-colors"
          >
            Shortlist
          </Link>
          <div className="flex items-center gap-0.5">
            <Link
              href="/generate"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all"
            >
              Generate
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-[var(--color-text-primary)] mb-3">
            Simple, honest pricing
          </h1>
          <p className="text-base text-[var(--color-text-secondary)]">
            Try free. Upgrade when you need more.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-[var(--color-elevated)] rounded-xl p-1 gap-1 border border-[var(--color-border)]">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-[var(--color-border)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "annual"
                  ? "bg-[var(--color-border)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Annual
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                Save {fmt(annualSavings)}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Free */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[var(--color-text-primary)]">$0</span>
                <span className="text-sm text-[var(--color-text-tertiary)]">/mo</span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">No credit card required</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-[var(--color-text-output)]">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/generate"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-all"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-indigo-600 rounded-2xl border border-indigo-600 p-8 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
                Most popular
              </span>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium text-indigo-200 mb-2">Pro</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{monthlyDisplay}</span>
                <span className="text-sm text-indigo-200">
                  /{billing === "annual" ? "mo, billed annually" : "mo"}
                </span>
              </div>
              {billing === "annual" && (
                <p className="text-sm text-indigo-200 mt-2">
                  {fmt(ANNUAL_PRICE_CENTS)}/year — 3 months free
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-sm text-indigo-100">{f}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-xs text-red-200 mb-3">{error}</p>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-white text-indigo-700 hover:bg-indigo-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : (
                "Upgrade to Pro →"
              )}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-8">
          Payments processed by Stripe. Cancel anytime.
        </p>
      </main>
    </div>
  );
}
