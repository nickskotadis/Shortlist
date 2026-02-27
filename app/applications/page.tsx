import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ApplicationsClient from "./ApplicationsClient";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: applications } = await supabase
    .from("job_applications")
    .select("id, company_name, job_title, status, url, notes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch generation counts per application
  const { data: generationCounts } = await supabase
    .from("generations")
    .select("job_application_id")
    .eq("user_id", user.id)
    .not("job_application_id", "is", null);

  const countMap: Record<string, number> = {};
  for (const g of generationCounts ?? []) {
    if (g.job_application_id) {
      countMap[g.job_application_id] = (countMap[g.job_application_id] ?? 0) + 1;
    }
  }

  const appsWithCounts = (applications ?? []).map((a) => ({
    ...a,
    generation_count: countMap[a.id] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold text-slate-900 tracking-tight">Shortlist</Link>
            <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
              <Link href="/dashboard" className="hover:text-slate-900 transition-colors">Dashboard</Link>
              <span className="font-medium text-slate-900">Applications</span>
              <Link href="/generate" className="hover:text-slate-900 transition-colors">Generate</Link>
              <Link href="/score" className="hover:text-slate-900 transition-colors">Score</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Job Applications</h1>
            <p className="text-sm text-slate-500 mt-1">Track your applications and linked documents</p>
          </div>
        </div>

        <ApplicationsClient initialApplications={appsWithCounts} />
      </main>
    </div>
  );
}
