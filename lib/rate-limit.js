/**
 * Tiny in-memory sliding window rate limiter.
 * Good enough to stop casual Grok burn on a single Vercel region.
 * Resets on cold start; not a global distributed lock.
 */

const buckets = new Map();

function prune(bucket, windowMs, now) {
  const cutoff = now - windowMs;
  while (bucket.length && bucket[0] <= cutoff) bucket.shift();
}

export function clientKeyFromRequest(req) {
  const xf = req.headers.get("x-forwarded-for") || "";
  const ip = xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  // optional sticky browser id if client ever sends one
  const aid = (req.headers.get("x-wringer-aid") || "").slice(0, 64);
  return aid ? `${ip}:${aid}` : ip;
}

/**
 * @returns {{ ok: true, remaining: number, resetMs: number } | { ok: false, remaining: 0, resetMs: number, retryAfterSec: number }}
 */
export function takeToken(key, { limit, windowMs, now = Date.now() } = {}) {
  const max = Math.max(1, Number(limit) || 10);
  const win = Math.max(1000, Number(windowMs) || 60 * 60 * 1000);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = [];
    buckets.set(key, bucket);
  }
  prune(bucket, win, now);

  if (bucket.length >= max) {
    const oldest = bucket[0];
    const resetMs = Math.max(0, oldest + win - now);
    return {
      ok: false,
      remaining: 0,
      resetMs,
      retryAfterSec: Math.max(1, Math.ceil(resetMs / 1000)),
    };
  }

  bucket.push(now);
  // hard cap map growth
  if (buckets.size > 5000) {
    const first = buckets.keys().next().value;
    buckets.delete(first);
  }

  return {
    ok: true,
    remaining: Math.max(0, max - bucket.length),
    resetMs: win,
  };
}

export function assistLimitConfig() {
  return {
    limit: Number(process.env.ASSIST_RATE_LIMIT || 12),
    windowMs: Number(process.env.ASSIST_RATE_WINDOW_MS || 60 * 60 * 1000), // 12/hour default
  };
}
