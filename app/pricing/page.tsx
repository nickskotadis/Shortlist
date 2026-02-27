"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";

const MONTHLY_PRICE_CENTS = 499; // $4.99/mo
const ANNUAL_PRICE_CENTS = 4999; // $49.99/yr (= ~$4.17/mo, 2 months free)

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
  "JD analysis + keyword tailoring",
  "Quality score on every output",
  "DOCX & PDF export",
];

const PRO_FEATURES = [
  "Unlimited generations",
  "Resume bullets, summary & cover letter",
  "JD analysis + keyword tailoring",
  "Quality score on every output",
  "DOCX & PDF export",
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
        body: JSON.stringify({
          billingPeriod: billing,
          successUrl: `${window.location.origin}/dashboard?upgraded=1`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
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
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-base font-semibold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors"
          >
            Shortlist
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/generate"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Generate
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-slate-900 mb-3">
            Simple, honest pricing
          </h1>
          <p className="text-base text-slate-500">
            Try free. Upgrade when you need more.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "annual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Annual
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Save {fmt(annualSavings)}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Free */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-500 mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-sm text-slate-400">/mo</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">No credit card required</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-slate-700">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/generate"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
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
                  {fmt(ANNUAL_PRICE_CENTS)}/year — 2 months free
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
        <p className="text-center text-xs text-slate-400 mt-8">
          Payments processed by Stripe. Cancel anytime.
        </p>
      </main>
    </div>
  );
}
