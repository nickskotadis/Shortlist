import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GenerationsClient, { type Generation } from "./GenerationsClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("generations")
    .select(
      "id, document_type, output_text, validator_scores, validator_verdict, retry_count, created_at, prompt_version, input_tokens, output_tokens, latency_ms, job_applications(company_name, job_title)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const generations = (data ?? []) as unknown as Generation[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-base font-semibold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors"
          >
            Shortlist
          </Link>
          <Link
            href="/generate"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all"
          >
            New generation
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-slate-900">Your generations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {generations.length}{" "}
            {generations.length === 1 ? "generation" : "generations"} saved
          </p>
        </div>

        <GenerationsClient generations={generations} />
      </main>
    </div>
  );
}
