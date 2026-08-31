import crypto from "crypto";
import Stripe from "stripe";
import { getSiteUrl, isFreeMode, requireEnv } from "./config-service.js";
import {
  entitlementMetadata,
  parseCheckoutRequest,
} from "./entitlement-service.js";
import { ServiceError, withResponseCookies } from "./http-service.js";
import {
  CHECKOUT_NONCE_COOKIE,
  CHECKOUT_NONCE_MAX_AGE_SECONDS,
  checkoutNonceHash,
  requireCookieSecret,
} from "./payment-cookie-service.js";

function productFor(entitlement) {
  if (entitlement.tier === "audit") {
    return {
      name: "The Wringer - one run",
      description: "One agent-contract audit + dry-run through The Wringer (Loop Protocol v5.0)",
    };
  }
  return {
    name: entitlement.isMega
      ? `The Wringer - MEGA MECHA RUN (${entitlement.agents} agents)`
      : "The Wringer - MECHA RUN",
    description: entitlement.isMega
      ? `${entitlement.agents} real agents across Claude/Codex/Grok lineages, judged by a tournament reviewer in an isolated sandbox (Loop Protocol v5.0)`
      : "Real agent execution of your contract in an isolated sandbox (Loop Protocol v5.0, shell access, hard cost ceiling)",
  };
}

export async function createCheckout(body, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const entitlement = parseCheckoutRequest(body);
  if (isFreeMode(env)) return { free: true };

  const siteUrl = getSiteUrl(env);
  requireCookieSecret(env);
  const stripe = dependencies.stripe ?? new Stripe(requireEnv("STRIPE_SECRET_KEY", env));
  const nonce = (dependencies.randomBytes ?? crypto.randomBytes)(32).toString("base64url");
  const paymentMetadata = entitlementMetadata(entitlement);
  const sessionMetadata = {
    ...paymentMetadata,
    wringer_checkout_nonce_hash: checkoutNonceHash(nonce),
  };
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      metadata: sessionMetadata,
      line_items: [
        {
          price_data: {
            currency: entitlement.currency,
            product_data: productFor(entitlement),
            unit_amount: entitlement.amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: { metadata: paymentMetadata },
      success_url: `${siteUrl}/api/checkout/callback?session_id={CHECKOUT_SESSION_ID}&tier=${entitlement.tier}`,
      cancel_url: `${siteUrl}/?canceled=1`,
    });
    if (!session?.url) throw new Error("missing checkout URL");
    return withResponseCookies(
      { url: session.url },
      [
        {
          name: CHECKOUT_NONCE_COOKIE,
          value: nonce,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/api/checkout/callback",
          maxAge: CHECKOUT_NONCE_MAX_AGE_SECONDS,
        },
      ]
    );
  } catch {
    throw new ServiceError("CHECKOUT_UNAVAILABLE", 502, "Checkout is unavailable.");
  }
}
