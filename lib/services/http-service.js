import { NextResponse } from "next/server.js";
import {
  PAYMENT_SESSION_COOKIE,
  verifyPaymentSessionCookie,
} from "./payment-cookie-service.js";

const MAX_REQUEST_BYTES = 64_000;
const RESPONSE_COOKIES = Symbol("responseCookies");
export { PAYMENT_SESSION_COOKIE };

export class ServiceError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export const invalidRequest = () =>
  new ServiceError("INVALID_REQUEST", 400, "Invalid request.");

export const configurationError = () =>
  new ServiceError("CONFIGURATION_ERROR", 503, "Service is not configured.");

export function errorResponse(error) {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  return NextResponse.json(
    { error: "Request failed.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

export function requestCookie(req, name) {
  const direct = req.cookies?.get?.(name)?.value;
  if (direct) return direct;
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function withResponseCookies(body, cookies) {
  return { body, cookies, [RESPONSE_COOKIES]: true };
}

export async function handleJsonPost(
  req,
  service,
  { paymentCookie = false, env = process.env } = {}
) {
  try {
    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      throw invalidRequest();
    }
    const text = await req.text();
    if (!text || Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) {
      throw invalidRequest();
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw invalidRequest();
    }
    let sessionSource = null;
    if (paymentCookie && body && typeof body === "object" && !Array.isArray(body)) {
      if (typeof body.sessionId === "string" && body.sessionId) {
        sessionSource = "body";
      } else {
        const signedSession = requestCookie(req, PAYMENT_SESSION_COOKIE);
        if (signedSession) {
          const sessionId = verifyPaymentSessionCookie(signedSession, env);
          body = { ...body, sessionId };
          sessionSource = "cookie";
        }
      }
    }
    const result = await service(body, { sessionSource });
    if (result?.[RESPONSE_COOKIES] === true) {
      const response = NextResponse.json(result.body);
      for (const cookie of result.cookies) response.cookies.set(cookie);
      return response;
    }
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export function assertPlainObject(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRequest();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw invalidRequest();
  }
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw invalidRequest();
  }
  return value;
}

export function boundedString(value, { min = 0, max, optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string") throw invalidRequest();
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) throw invalidRequest();
  return normalized;
}
