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
  const priceCents =
    tier === "mecha"
      ? parseInt(process.env.MECHA_PRICE_CENTS || "1000", 10)
      : parseInt(process.env.PRICE_CENTS || "100", 10);
  const product =
    tier === "mecha"
      ? {
          name: "The Wringer — MECHA RUN",
          description:
            "Real agent execution of your contract in an isolated sandbox (Loop Protocol v5.0, shell access, hard cost ceiling)",
        }
      : {
          name: "The Wringer — one run",
          description: "One agent-contract audit + dry-run through The Wringer (Loop Protocol v5.0)",
        };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
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
