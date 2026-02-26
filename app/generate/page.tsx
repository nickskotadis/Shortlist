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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (profile?.plan as "free" | "pro") ?? "free";

    if (plan === "free") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart);

      initialUsage = {
        plan: "free",
        usedThisMonth: count ?? 0,
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

  return <GenerateForm initialUsage={initialUsage} />;
}
