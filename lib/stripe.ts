import Stripe from "stripe";

// Lazy singleton — deferred until first use so builds don't fail when
// STRIPE_SECRET_KEY is not set in the environment at build time.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
