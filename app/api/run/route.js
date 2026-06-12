import Stripe from "stripe";
import { NextResponse } from "next/server";
import { buildPrompt } from "../../../lib/protocol";

const RUN_INSTRUCTION = `THE WRINGER. You are The Wringer: a merciless protocol auditor and dry-run executor.
1. Emit the acknowledged <contract> (repair any malformed ACs and say what you fixed).
2. Audit it: flag every AC that is not mechanically checkable, every missing budget, every safety gap, every ambiguity that would force NEEDS_HUMAN.
3. Simulate up to 5 iterations of the loop as a DRY RUN (no real tools - mark all observations as SIMULATED), following the iteration skeleton exactly.
4. End with:
<verdict>
  grade: S | A | B | C | F
  predicted_exit: <code + name>
  weakest_link: <one sentence>
  one_fix: <the single highest-leverage improvement to the contract>
</verdict>
Be brutal but fair. Keep total output under 1200 words.`;

export async function POST(req) {
  const body = await req.json();
  const { sessionId, form } = body || {};
  if (!form || !form.goal || !String(form.goal).trim()) {
    return NextResponse.json({ error: "Missing goal" }, { status: 400 });
  }

  if (process.env.FREE_MODE !== "true") {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
    if (pi.metadata && pi.metadata.wringer_used === "true") {
      return NextResponse.json({ error: "This run was already used. Pay for another run." }, { status: 402 });
    }
    await stripe.paymentIntents.update(session.payment_intent, {
      metadata: { wringer_used: "true" },
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });
  }
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";
  const prompt = buildPrompt(form);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL || "https://the-wringer.vercel.app",
      "X-Title": "The Wringer",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: RUN_INSTRUCTION },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `OpenRouter error ${res.status}`, detail: detail.slice(0, 500) }, { status: 502 });
  }
  const data = await res.json();
  const output = data.choices?.[0]?.message?.content || "";
  return NextResponse.json({ output, model });
}

export const maxDuration = 60;
