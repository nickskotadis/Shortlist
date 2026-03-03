import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FREE_MONTHLY_LIMIT } from "@/lib/constants";
import GenerationsClient, { type Generation } from "./GenerationsClient";
import Nav from "@/components/Nav";

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
    <div className="min-h-screen bg-[#090C18]">
      <Nav
        activePage="dashboard"
        actions={
          <Link
            href="/generate"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-px"
          >
            New generation
          </Link>
        }
      />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-lg font-semibold text-[#EEEEFC]">Your generations</h1>
              <p className="text-sm text-[#8888A8] mt-0.5">
                {generations.length}{" "}
                {generations.length === 1 ? "generation" : "generations"} saved
              </p>
            </div>

            {/* Usage bar — free users only */}
            {plan === "free" && (
              <div className="min-w-[200px] max-w-xs w-full sm:w-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${usedThisMonth >= FREE_MONTHLY_LIMIT ? "text-amber-400" : "text-[#8888A8]"}`}>
                    {usedThisMonth} of {FREE_MONTHLY_LIMIT} used this month
                  </span>
                </div>
                <div className="h-1.5 bg-[#232548] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usedThisMonth >= FREE_MONTHLY_LIMIT ? "bg-amber-500" : "bg-indigo-500"
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
