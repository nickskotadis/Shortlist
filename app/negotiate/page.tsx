import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import NegotiateClient from "./NegotiateClient";

export default async function NegotiatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: "free" | "pro" = "free";
  let savedResume: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, resume_text")
      .eq("id", user.id)
      .single();
    plan = (data?.plan as "free" | "pro") ?? "free";
    savedResume = data?.resume_text ?? null;
  }

  return (
    <div className="min-h-screen bg-[#090C18]">
      <Nav activePage="negotiate" />
      <NegotiateClient plan={plan} savedResume={savedResume} isAuthed={!!user} />
    </div>
  );
}
