import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req) {
  if (process.env.FREE_MODE === "true") {
    return NextResponse.json({ free: true });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.get("origin") || process.env.SITE_URL || "http://localhost:3000";
  const priceCents = parseInt(process.env.PRICE_CENTS || "100", 10);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Mecha Auth Run",
            description: "One protocol audit + dry-run through the Mecha (Loop Protocol v5.0)",
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  return NextResponse.json({ url: session.url });
}
