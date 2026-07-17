import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Derive return URL server-side — never trust client-supplied redirect
  // targets. Only trust x-forwarded-host for known Vercel domains (same rule as
  // auth/callback); otherwise fall back to localhost (dev) or the canonical URL.
  const ALLOWED_HOST_PATTERN = /^[a-z0-9-]+\.vercel\.app$/;
  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = req.headers.get("host") ?? "";
  const isLocal = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
  const host =
    forwardedHost && ALLOWED_HOST_PATTERN.test(forwardedHost)
      ? `https://${forwardedHost}`
      : isLocal
      ? `http://${hostHeader}`
      : "https://shortlist-amber.vercel.app";
  const returnUrl = `${host}/dashboard`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found. Upgrade to Pro to manage your subscription." },
      { status: 400 }
    );
  }

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portalSession.url });
}
