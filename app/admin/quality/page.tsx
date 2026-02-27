import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

interface VersionStats {
  prompt_version: string;
  ab_variant: string | null;
  count: number;
  avg_overall: number;
  pass_rate: number;
  feedback_positive_rate: number;
}

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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900 tracking-tight">
            Shortlist
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-500">Admin · Quality Dashboard</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Generation Quality</h1>
          <p className="text-sm text-slate-500 mt-1">
            Stats by prompt version — {totalGens.toLocaleString()} total generations
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Prompt Version
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Variant
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Count
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Avg Score
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pass Rate
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  👍 Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">
                    {row.prompt_version}
                  </td>
                  <td className="px-6 py-4">
                    {row.ab_variant ? (
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.ab_variant === "B"
                            ? "text-indigo-700 bg-indigo-50"
                            : "text-slate-500 bg-slate-100"
                        }`}
                      >
                        {row.ab_variant ?? "A"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{row.count}</td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        row.avg_overall >= 7
                          ? "text-emerald-600"
                          : row.avg_overall >= 5.5
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {row.avg_overall}/10
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        row.pass_rate >= 80
                          ? "text-emerald-600"
                          : row.pass_rate >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {row.pass_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        row.feedback_positive_rate >= 70 ? "text-emerald-600" : "text-slate-500"
                      }`}
                    >
                      {row.feedback_positive_rate > 0
                        ? `${row.feedback_positive_rate}%`
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-400"
                  >
                    No generation data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
