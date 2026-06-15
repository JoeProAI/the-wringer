import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const tier = body?.tier === "mecha" ? "mecha" : "audit";
  if (process.env.FREE_MODE === "true") {
    return NextResponse.json({ free: true });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.get("origin") || process.env.SITE_URL || "http://localhost:3000";
  const baseMechaCents = parseInt(process.env.MECHA_PRICE_CENTS || "1000", 10);
  // Mega MECHA Run: price scales with agent count. base + perAgent*(agents-4),
  // capped. Defaults make 25≈$17, 50≈$26, 100=$40. Non-mega tiers keep base.
  const perAgentCents = parseInt(process.env.MEGA_PRICE_PER_AGENT_CENTS || "35", 10);
  const capCents = parseInt(process.env.MEGA_PRICE_CAP_CENTS || "4000", 10);
  const reqAgents = parseInt(body?.agents, 10);
  const isMega = tier === "mecha" && Number.isFinite(reqAgents) && reqAgents > 4;
  const megaAgents = isMega ? Math.max(3, Math.min(100, reqAgents)) : 0;
  let priceCents;
  if (tier === "mecha") {
    priceCents = isMega
      ? Math.min(baseMechaCents + perAgentCents * (megaAgents - 4), capCents)
      : baseMechaCents;
  } else {
    priceCents = parseInt(process.env.PRICE_CENTS || "100", 10);
  }
  const product =
    tier === "mecha"
      ? {
          name: isMega ? `The Wringer — MEGA MECHA RUN (${megaAgents} agents)` : "The Wringer — MECHA RUN",
          description: isMega
            ? `${megaAgents} real agents across Claude/Codex/Grok lineages, judged by a tournament reviewer in an isolated sandbox (Loop Protocol v5.0)`
            : "Real agent execution of your contract in an isolated sandbox (Loop Protocol v5.0, shell access, hard cost ceiling)",
        }
      : {
          name: "The Wringer — one run",
          description: "One agent-contract audit + dry-run through The Wringer (Loop Protocol v5.0)",
        };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    allow_promotion_codes: true,
    metadata: { wringer_tier: tier, ...(isMega ? { wringer_mega_agents: String(megaAgents) } : {}) },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: product,
          unit_amount: priceCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: { metadata: { wringer_tier: tier } },
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  return NextResponse.json({ url: session.url });
}
