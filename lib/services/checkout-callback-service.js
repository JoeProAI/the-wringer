import { NextResponse } from "next/server.js";
import { verifyPayment } from "../verify-payment.js";
import { parseSessionId } from "./case-service.js";
import { getSiteUrl } from "./config-service.js";
import { invalidRequest, requestCookie } from "./http-service.js";
import {
  CHECKOUT_NONCE_COOKIE,
  nonceMatchesHash,
  PAYMENT_COOKIE_MAX_AGE_SECONDS,
  PAYMENT_SESSION_COOKIE,
  signPaymentSession,
} from "./payment-cookie-service.js";

export async function completeCheckoutCallback(req, dependencies = {}) {
  let url;
  try {
    url = new URL(req.url);
  } catch {
    throw invalidRequest();
  }
  const tier = url.searchParams.get("tier");
  if (tier !== "audit" && tier !== "mecha") throw invalidRequest();
  const sessionId = parseSessionId(url.searchParams.get("session_id"));
  const env = dependencies.env ?? process.env;
  const payment = await (dependencies.verifyPayment ?? verifyPayment)(sessionId, tier, {
    env,
    ...dependencies.paymentDependencies,
    allowLegacy: false,
  });
  const nonce = requestCookie(req, CHECKOUT_NONCE_COOKIE);
  if (!nonceMatchesHash(nonce, payment.checkoutNonceHash)) throw invalidRequest();

  const siteUrl = getSiteUrl(env);
  const response = NextResponse.redirect(`${siteUrl}/?tier=${tier}&paid=1`, 303);
  response.cookies.set({
    name: PAYMENT_SESSION_COOKIE,
    value: signPaymentSession(sessionId, env),
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api",
    maxAge: PAYMENT_COOKIE_MAX_AGE_SECONDS,
  });
  response.cookies.set({
    name: CHECKOUT_NONCE_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/checkout/callback",
    maxAge: 0,
  });
  return response;
}

export const checkoutCallbackInternals = { PAYMENT_COOKIE_MAX_AGE_SECONDS };
