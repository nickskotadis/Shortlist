import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { positive } = body as Record<string, unknown>;

  if (typeof positive !== "boolean") {
    return Response.json({ error: "positive must be a boolean" }, { status: 400 });
  }

  const { count } = await supabase
    .from("generations")
    .update({ feedback_positive: positive }, { count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (count === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
