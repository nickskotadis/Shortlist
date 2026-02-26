import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH — update the label on a generation (owned by the authenticated user)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.label !== "string") {
    return NextResponse.json({ error: "label must be a string" }, { status: 400 });
  }

  if (body.label.length > 200) {
    return NextResponse.json({ error: "Label too long (max 200 characters)" }, { status: 400 });
  }

  // RLS ensures user can only update their own rows
  const { error } = await supabase
    .from("generations")
    .update({ label: body.label || null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
