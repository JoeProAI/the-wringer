import Stripe from "stripe";
import { requireEnv } from "./services/config-service.js";
import { getEntitlement, entitlementMetadata } from "./services/entitlement-service.js";
import { createRedisClaimLedger } from "./services/payment-claim-service.js";
import { ServiceError } from "./services/http-service.js";

const paymentError = () =>
  new ServiceError("PAYMENT_INVALID", 402, "Payment is invalid or incomplete.");

function parseCurrentEntitlement(session, requestedTier) {
  const metadata = session.metadata ?? {};
  if (metadata.wringer_schema !== "2" || metadata.wringer_tier !== requestedTier) {
    throw paymentError();
  }
  if (!/^\d+$/.test(metadata.wringer_agents ?? "")) throw paymentError();
  const agents = Number(metadata.wringer_agents);
  const requestedAgents = requestedTier === "mecha" && agents > 4 ? agents : undefined;
  const expected = getEntitlement(requestedTier, requestedAgents);
  const exact = entitlementMetadata(expected);
  if (Object.entries(exact).some(([key, value]) => metadata[key] !== value)) {
    throw paymentError();
  }
  return expected;
}

function parseLegacyEntitlement(session, requestedTier) {
  const metadata = session.metadata ?? {};
  if (metadata.wringer_schema !== undefined || metadata.wringer_tier !== requestedTier) {
    throw paymentError();
  }
  let requestedAgents;
  if (requestedTier === "mecha" && metadata.wringer_mega_agents !== undefined) {
    if (!/^\d+$/.test(metadata.wringer_mega_agents)) throw paymentError();
    requestedAgents = Number(metadata.wringer_mega_agents);
    if (requestedAgents <= 4) throw paymentError();
  }
  return getEntitlement(requestedTier, requestedAgents);
}

function verifyMoney(session, entitlement) {
  const items = session.line_items?.data;
  if (
    session.mode !== "payment" ||
    session.status !== "complete" ||
    !Array.isArray(items) ||
    items.length !== 1 ||
    items[0].quantity !== 1 ||
    items[0].currency !== entitlement.currency ||
    items[0].amount_subtotal !== entitlement.amountCents ||
    session.currency !== entitlement.currency ||
    session.amount_subtotal !== entitlement.amountCents ||
    !Number.isInteger(session.amount_total) ||
    session.amount_total < 0 ||
    session.amount_total > entitlement.amountCents
  ) {
    throw paymentError();
  }
}

function verifyPaymentIntent(session, paymentIntent, entitlement, legacy) {
  if (!paymentIntent) {
    if (
      session.payment_status !== "no_payment_required" ||
      session.amount_total !== 0 ||
      (legacy && session.metadata?.wringer_used === "true")
    ) {
      throw paymentError();
    }
    return;
  }
  const metadataValid = legacy
    ? paymentIntent.metadata?.wringer_tier === entitlement.tier &&
      paymentIntent.metadata?.wringer_used !== "true"
    : Object.entries(entitlementMetadata(entitlement)).every(
        ([key, value]) => paymentIntent.metadata?.[key] === value
      );
  if (
    session.payment_status !== "paid" ||
    paymentIntent.status !== "succeeded" ||
    paymentIntent.currency !== entitlement.currency ||
    paymentIntent.amount !== session.amount_total ||
    paymentIntent.amount_received !== session.amount_total ||
    !metadataValid
  ) {
    throw paymentError();
  }
}

export async function verifyPayment(sessionId, tier, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  if (!sessionId) {
    throw new ServiceError("PAYMENT_REQUIRED", 402, "Payment is required.");
  }
  const stripe = dependencies.stripe ?? new Stripe(requireEnv("STRIPE_SECRET_KEY", env));
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });
  } catch {
    throw paymentError();
  }

  const legacy = session.metadata?.wringer_schema !== "2";
  if ((legacy && dependencies.allowLegacy !== true) || (!legacy && dependencies.requireLegacy === true)) {
    throw paymentError();
  }
  const entitlement = legacy
    ? parseLegacyEntitlement(session, tier)
    : parseCurrentEntitlement(session, tier);
  if (dependencies.expectedAgents !== undefined && entitlement.agents !== dependencies.expectedAgents) {
    throw paymentError();
  }
  verifyMoney(session, entitlement);
  let paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string") {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
    } catch {
      throw paymentError();
    }
  }
  verifyPaymentIntent(session, paymentIntent, entitlement, legacy);
  return {
    ...entitlement,
    sessionId,
    legacy,
    checkoutNonceHash: session.metadata?.wringer_checkout_nonce_hash,
  };
}

export async function verifyAndConsume(sessionId, tier, dependencies = {}) {
  const entitlement = await verifyPayment(sessionId, tier, dependencies);
  const ledger = dependencies.ledger ?? createRedisClaimLedger({
    env: dependencies.env ?? process.env,
    fetchImpl: dependencies.redisFetch ?? fetch,
  });
  const claim = await ledger.begin(entitlement);
  return {
    ok: true,
    paidAgents: entitlement.agents,
    entitlement,
    ledger,
    claim: claim.status === "claimed" ? claim : null,
    replay: claim.status === "completed" ? claim : null,
  };
}

export const paymentVerificationInternals = {
  parseCurrentEntitlement,
  parseLegacyEntitlement,
  verifyMoney,
  verifyPaymentIntent,
};
