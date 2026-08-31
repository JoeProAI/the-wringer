import crypto from "crypto";
import { configurationError, invalidRequest } from "./http-service.js";

export const PAYMENT_SESSION_COOKIE = "wringer_payment";
export const CHECKOUT_NONCE_COOKIE = "wringer_checkout_nonce";
export const CHECKOUT_NONCE_MAX_AGE_SECONDS = 10 * 60;
export const PAYMENT_COOKIE_MAX_AGE_SECONDS = 5 * 60 * 60;

export function requireCookieSecret(env = process.env) {
  const secret = env.WRINGER_COOKIE_SECRET;
  if (typeof secret !== "string" || secret.length < 32) throw configurationError();
  return secret;
}

export function checkoutNonceHash(nonce) {
  return crypto.createHash("sha256").update(nonce).digest("hex");
}

export function signPaymentSession(sessionId, env = process.env) {
  const signature = crypto
    .createHmac("sha256", requireCookieSecret(env))
    .update(sessionId)
    .digest("hex");
  return `${sessionId}.${signature}`;
}

export function verifyPaymentSessionCookie(value, env = process.env) {
  if (typeof value !== "string") return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) throw invalidRequest();
  const sessionId = value.slice(0, separator);
  const supplied = value.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/.test(supplied)) throw invalidRequest();
  const expected = crypto
    .createHmac("sha256", requireCookieSecret(env))
    .update(sessionId)
    .digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw invalidRequest();
  }
  return sessionId;
}

export function nonceMatchesHash(nonce, expectedHash) {
  if (
    typeof nonce !== "string" ||
    nonce.length < 32 ||
    nonce.length > 128 ||
    typeof expectedHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    return false;
  }
  const actual = Buffer.from(checkoutNonceHash(nonce), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
