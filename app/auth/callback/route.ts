import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | null;
  const next = searchParams.get("next") ?? "/generate";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // On Vercel, the forwarded host is the canonical domain
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${host}${next}`);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${host}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=1`);
}
