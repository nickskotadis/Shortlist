import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | null;
  // Validate next is a same-origin relative path — prevent open redirect
  const rawNext = searchParams.get("next") ?? "/generate";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/generate";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ? `https://${forwardedHost}` : origin;

  if (code) {
    // For OAuth PKCE: build the redirect response first, then wire Supabase cookies
    // directly to it. This guarantees Set-Cookie headers are on the redirect response
    // rather than relying on cookies() from next/headers being merged — which is
    // unreliable when the handler returns NextResponse.redirect().
    const redirectResponse = NextResponse.redirect(`${host}${next}`);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Read PKCE code_verifier + any existing auth cookies from the request
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Write session cookies directly onto the redirect response
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse;
    }
  }

  if (token_hash && type) {
    // Magic link / OTP: uses createClient() helper — works fine here because
    // verifyOtp doesn't read client-side PKCE cookies from the request.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${host}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=1`);
}
