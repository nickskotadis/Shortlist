// ── IP-based rate limiting ────────────────────────────────────────────────────
// Fixed-window limiter for anonymous/unauthenticated traffic. Uses Upstash when
// configured (shared across serverless instances); otherwise falls back to an
// in-memory Map that resets on cold start — the same best-effort tradeoff as the
// per-user cooldown in /api/follow-up. Adds abuse friction without a hard quota.

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
let _redisResolved = false;

function getRedis(): Redis | null {
  if (!_redisResolved) {
    _redisResolved = true;
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
  }
  return _redis;
}

// In-memory fallback store: key → { count, resetAt (epoch ms) }.
const memoryHits = new Map<string, { count: number; resetAt: number }>();

function sweepExpired(now: number) {
  if (memoryHits.size < 5_000) return;
  for (const [k, v] of memoryHits) {
    if (now >= v.resetAt) memoryHits.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// Returns whether `key` is within `limit` requests per `windowSec`.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec);
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    };
  }

  const now = Date.now();
  sweepExpired(now);
  const entry = memoryHits.get(key);
  if (!entry || now >= entry.resetAt) {
    memoryHits.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSec: windowSec };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
