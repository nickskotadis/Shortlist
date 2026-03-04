import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import InterviewClient from "./InterviewClient";

export default async function InterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedResume: string | null = null;
  let plan: "free" | "pro" = "free";

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, resume_text")
      .eq("id", user.id)
      .single();
    savedResume = data?.resume_text ?? null;
    plan = (data?.plan as "free" | "pro") ?? "free";
  }

  return (
    <div className="min-h-screen bg-[#090C18]">
      <Nav activePage="interview" />
      <InterviewClient savedResume={savedResume} plan={plan} />
    </div>
  );
}
