import Stripe from "stripe";

// Verifies a Stripe checkout session for the given tier and marks it used.
// Handles both paid sessions (metadata on the PaymentIntent) and 100%-off
// promo-code sessions (no PaymentIntent; metadata on the session itself).
// Returns { ok: true, paidAgents } on success, or { error, status } on failure.
// paidAgents is the agent count the session was actually priced for, read from
// server-set session metadata (4 = base MECHA RUN). Callers must cap any
// client-requested agent count to this so a cheap session can't be replayed as
// a higher Mega tier.
export async function verifyAndConsume(sessionId, tier) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Stripe not configured", status: 500 };
  }
  if (!sessionId) {
    return { error: "Payment required", status: 402 };
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) {
    return { error: "Payment not completed", status: 402 };
  }

  // The paid agent count is stamped on the SESSION at checkout (both paid and
  // promo paths), based on the price charged. Absent => base MECHA RUN (4).
  const m = parseInt(session.metadata?.wringer_mega_agents, 10);
  const paidAgents = Number.isFinite(m) ? Math.max(3, Math.min(100, m)) : 4;

  if (session.payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
    if (tier === "mecha" && pi.metadata?.wringer_tier !== "mecha") {
      return { error: "This payment is for the audit tier, not MECHA RUN.", status: 402 };
    }
    if (pi.metadata?.wringer_used === "true") {
      return { error: "This run was already used. Pay for another run.", status: 402 };
    }
    await stripe.paymentIntents.update(session.payment_intent, {
      metadata: { wringer_used: "true", wringer_tier: tier },
    });
    return { ok: true, paidAgents };
  }

  // Promo-code ($0) session: no PaymentIntent exists.
  if (tier === "mecha" && session.metadata?.wringer_tier !== "mecha") {
    return { error: "This pass is for the audit tier, not MECHA RUN.", status: 402 };
  }
  if (session.metadata?.wringer_used === "true") {
    return { error: "This pass was already used.", status: 402 };
  }
  try {
    await stripe.checkout.sessions.update(sessionId, {
      metadata: { ...session.metadata, wringer_used: "true" },
    });
  } catch {
    // Session metadata not updatable — promo redemption caps still bound total free runs.
  }
  return { ok: true, paidAgents };
}
