import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Lazy singleton — deferred until first use so `next build` doesn't crash
// evaluating this module when NEXT_PUBLIC_SUPABASE_URL is unset at build time.
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase service-role env vars are not set");
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("[stripe/webhook] Signature error:", message);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId) break;

        const { error: err1 } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "pro",
            stripe_customer_id: session.customer as string,
          })
          .eq("id", userId);
        if (err1) throw err1;
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const newPlan = subscription.status === "active" ? "pro" : "free";

        const { error: err2 } = await supabaseAdmin
          .from("profiles")
          .update({ plan: newPlan })
          .eq("stripe_customer_id", customerId);
        if (err2) throw err2;
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error: err3 } = await supabaseAdmin
          .from("profiles")
          .update({ plan: "free" })
          .eq("stripe_customer_id", customerId);
        if (err3) throw err3;
        break;
      }

      default:
        // Return 200 for unhandled events — don't 400
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
