import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import FitClient from "./FitClient";

export default async function FitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: "free" | "pro" = "free";
  let fitCount = 0;
  let savedResume: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, fit_count, resume_text")
      .eq("id", user.id)
      .single();
    plan = (data?.plan as "free" | "pro") ?? "free";
    fitCount = data?.fit_count ?? 0;
    savedResume = data?.resume_text ?? null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <Nav activePage="fit" />
      <FitClient plan={plan} fitCount={fitCount} savedResume={savedResume} />
    </div>
  );
}
