import { createClient } from "@/lib/supabase/server";
import { FREE_MONTHLY_LIMIT } from "@/lib/constants";
import GenerateForm from "./GenerateForm";
import type { PlanUsage } from "./GenerateForm";

export default async function GeneratePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialUsage: PlanUsage | null = null;
  let savedResume: string | null = null;

  if (user) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [profileResult, usageResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("plan, resume_text")
        .eq("id", user.id)
        .single(),
      supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart),
    ]);

    const plan = (profileResult.data?.plan as "free" | "pro") ?? "free";
    savedResume = profileResult.data?.resume_text ?? null;

    if (plan === "free") {
      initialUsage = {
        plan: "free",
        usedThisMonth: usageResult.count ?? 0,
        limit: FREE_MONTHLY_LIMIT,
      };
    } else {
      initialUsage = {
        plan: "pro",
        usedThisMonth: 0,
        limit: null,
      };
    }
  }

  return <GenerateForm initialUsage={initialUsage} savedResume={savedResume} userEmail={user?.email ?? null} />;
}
