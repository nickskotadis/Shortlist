import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { billingPeriod: "monthly" | "annual"; successUrl: string; cancelUrl: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { billingPeriod, successUrl, cancelUrl } = body;
  if (!billingPeriod || !successUrl || !cancelUrl) {
    return NextResponse.json(
      { error: "Missing required fields: billingPeriod, successUrl, cancelUrl" },
      { status: 400 }
    );
  }
  if (!["monthly", "annual"].includes(billingPeriod)) {
    return NextResponse.json({ error: "Invalid billingPeriod" }, { status: 400 });
  }

  const priceId =
    billingPeriod === "monthly"
      ? process.env.STRIPE_PRICE_ID_PRO_MONTHLY
      : process.env.STRIPE_PRICE_ID_PRO_ANNUAL;

  if (!priceId) {
    return NextResponse.json({ error: "Stripe price not configured" }, { status: 500 });
  }

  // ── Fetch existing customer ID if available ────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const existingCustomerId = profile?.stripe_customer_id ?? null;

  // ── Create Checkout Session ────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: user.email }),
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // ── Save new customer ID back to profiles (if Stripe created one) ──────────
  if (!existingCustomerId && session.customer) {
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: session.customer as string })
      .eq("id", user.id);
  }

  return NextResponse.json({ url: session.url });
}
