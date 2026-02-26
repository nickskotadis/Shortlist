import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — fetch the authenticated user's saved resume text
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("resume_text")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resume_text: data?.resume_text ?? null });
}

// PUT — save/overwrite the authenticated user's resume text
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { resume_text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.resume_text !== "string") {
    return NextResponse.json({ error: "resume_text must be a string" }, { status: 400 });
  }

  if (body.resume_text.length > 20_000) {
    return NextResponse.json({ error: "Resume text too long (max 20,000 characters)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ resume_text: body.resume_text || null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
