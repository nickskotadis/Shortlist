import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import ScoreClient from "./ScoreClient";

export default async function ScorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: "free" | "pro" = "free";
  let scoreCount = 0;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, score_count")
      .eq("id", user.id)
      .single();
    plan = (data?.plan as "free" | "pro") ?? "free";
    scoreCount = data?.score_count ?? 0;
  }

  return (
    <div className="min-h-screen bg-[#090C18]">
      <Nav activePage="score" />
      <ScoreClient plan={plan} scoreCount={scoreCount} />
    </div>
  );
}
