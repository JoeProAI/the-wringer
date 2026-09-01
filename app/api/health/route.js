import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const checks = {
    paymentLedger: Boolean(
      (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
    ),
    paymentCookie: Boolean(process.env.WRINGER_COOKIE_SECRET || process.env.WRINGER_PREVIEW_COOKIE_SECRET),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    quickAttack: Boolean(process.env.OPENROUTER_API_KEY),
    fullCase: Boolean(process.env.OPENROUTER_MANAGEMENT_KEY && process.env.DAYTONA_API_KEY),
  };
  const configured = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: configured ? "ok" : "degraded", webmcp: true, checks },
    { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
