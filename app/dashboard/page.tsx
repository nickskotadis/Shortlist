import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FREE_MONTHLY_LIMIT } from "@/lib/constants";
import GenerationsClient, { type Generation } from "./GenerationsClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // ── Fetch generations + profile in parallel ────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [generationsResult, profileResult, usageResult] = await Promise.all([
    supabase
      .from("generations")
      .select(
        "id, document_type, output_text, label, validator_scores, validator_verdict, retry_count, created_at, prompt_version, input_tokens, output_tokens, latency_ms, feedback_positive, job_applications(company_name, job_title)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single(),
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart),
  ]);

  const generations = (generationsResult.data ?? []) as unknown as Generation[];
  const plan = (profileResult.data?.plan as "free" | "pro") ?? "free";
  const usedThisMonth = usageResult.count ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-base font-semibold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors"
            >
              Shortlist
            </Link>
            <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
              <span className="font-medium text-slate-900">Dashboard</span>
              <Link href="/applications" className="hover:text-slate-900 transition-colors">Applications</Link>
              <Link href="/generate" className="hover:text-slate-900 transition-colors">Generate</Link>
              <Link href="/score" className="hover:text-slate-900 transition-colors">Score</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Plan badge */}
            {plan === "pro" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-indigo-700 bg-indigo-50">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                Pro
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-slate-500 bg-slate-100">
                Free
                <Link
                  href="/pricing"
                  className="text-indigo-600 hover:text-indigo-700 font-semibold ml-0.5 transition-colors"
                >
                  Upgrade →
                </Link>
              </span>
            )}
            <Link
              href="/generate"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              New generation
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Your generations</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {generations.length}{" "}
                {generations.length === 1 ? "generation" : "generations"} saved
              </p>
            </div>

            {/* Usage bar — free users only */}
            {plan === "free" && (
              <div className="min-w-[200px] max-w-xs w-full sm:w-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${usedThisMonth >= FREE_MONTHLY_LIMIT ? "text-amber-700" : "text-slate-600"}`}>
                    {usedThisMonth} of {FREE_MONTHLY_LIMIT} used this month
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usedThisMonth >= FREE_MONTHLY_LIMIT ? "bg-amber-400" : "bg-indigo-400"
                    }`}
                    style={{ width: `${Math.min((usedThisMonth / FREE_MONTHLY_LIMIT) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <GenerationsClient generations={generations} />
      </main>
    </div>
  );
}
