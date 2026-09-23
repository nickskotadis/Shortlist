// ── Canonical site URL + trusted host derivation ──────────────────────────────
// Redirect targets (OAuth callback, Stripe checkout/portal) must never be taken
// from the client. We only trust x-forwarded-host when it matches a host we own,
// and otherwise fall back to the canonical production URL.

export const CANONICAL_SITE_URL = "https://shortlist.sko.codes";

// The custom domain plus any Vercel deployment/preview host for this project.
const ALLOWED_HOST_PATTERNS = [
  /^shortlist\.sko\.codes$/,
  /^[a-z0-9-]+\.vercel\.app$/,
];

function isTrustedHost(host: string): boolean {
  return ALLOWED_HOST_PATTERNS.some((re) => re.test(host));
}

/**
 * Origin to build absolute redirect URLs against.
 * Prefers a trusted x-forwarded-host (so the user stays on the domain they
 * arrived on), then localhost in dev, then the canonical production URL.
 */
export function getSiteOrigin(headers: Headers): string {
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost && isTrustedHost(forwardedHost)) {
    return `https://${forwardedHost}`;
  }

  const hostHeader = headers.get("host") ?? "";
  if (hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1")) {
    return `http://${hostHeader}`;
  }
  if (isTrustedHost(hostHeader)) {
    return `https://${hostHeader}`;
  }

  return CANONICAL_SITE_URL;
}
