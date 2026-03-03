import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import QualityClient from "./QualityClient";
import type { VersionStats } from "./QualityClient";

export default async function AdminQualityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!user || !adminEmails.includes(user.email ?? "")) {
    redirect("/");
  }

  const { data: generations } = await supabase
    .from("generations")
    .select("prompt_version, ab_variant, validator_verdict, validator_scores, feedback_positive")
    .not("prompt_version", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  // Aggregate by prompt_version + ab_variant
  const statsMap = new Map<
    string,
    { prompt_version: string; ab_variant: string | null; count: number; totalScore: number; passes: number; positiveFeedback: number; feedbackTotal: number }
  >();

  for (const gen of generations ?? []) {
    const key = `${gen.prompt_version}::${gen.ab_variant ?? "A"}`;
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        prompt_version: gen.prompt_version ?? "unknown",
        ab_variant: gen.ab_variant ?? null,
        count: 0,
        totalScore: 0,
        passes: 0,
        positiveFeedback: 0,
        feedbackTotal: 0,
      });
    }
    const s = statsMap.get(key)!;
    s.count++;
    const scores = gen.validator_scores as Record<string, number> | null;
    if (scores) {
      const vals = Object.values(scores);
      s.totalScore += vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    if (gen.validator_verdict === "PASS") s.passes++;
    if (gen.feedback_positive !== null && gen.feedback_positive !== undefined) {
      s.feedbackTotal++;
      if (gen.feedback_positive) s.positiveFeedback++;
    }
  }

  const stats: VersionStats[] = Array.from(statsMap.values())
    .map((s) => ({
      prompt_version: s.prompt_version,
      ab_variant: s.ab_variant,
      count: s.count,
      avg_overall: s.count > 0 ? Math.round((s.totalScore / s.count) * 10) / 10 : 0,
      pass_rate: s.count > 0 ? Math.round((s.passes / s.count) * 100) : 0,
      feedback_positive_rate:
        s.feedbackTotal > 0 ? Math.round((s.positiveFeedback / s.feedbackTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalGens = generations?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#090C18]">
      <nav className="bg-[#090C18]/80 backdrop-blur-xl border-b border-[#1A1D38] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-4 h-14">
          <Link href="/dashboard" className="text-base font-semibold text-[#EEEEFC] tracking-tight hover:text-indigo-400 transition-colors">
            Shortlist
          </Link>
          <span className="text-[#363960]">·</span>
          <span className="text-sm text-[#8888A8]">Admin · Quality Dashboard</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#EEEEFC]">Generation Quality</h1>
          <p className="text-sm text-[#8888A8] mt-1">
            Stats by prompt version — {totalGens.toLocaleString()} total generations
          </p>
        </div>

        <QualityClient stats={stats} totalGens={totalGens} />
      </main>
    </div>
  );
}
