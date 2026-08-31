import { configurationError } from "./http-service.js";

export function getSiteUrl(env = process.env) {
  const configured = env.SITE_URL;
  if (!configured) {
    if (env.NODE_ENV === "production") throw configurationError();
    return "http://localhost:3000";
  }

  let url;
  try {
    url = new URL(configured);
  } catch {
    throw configurationError();
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && isLocal && url.protocol === "http:"))
  ) {
    throw configurationError();
  }
  return url.origin;
}

export function isFreeMode(env = process.env) {
  if (env.FREE_MODE !== "true") return false;
  if (env.NODE_ENV === "production") throw configurationError();
  return true;
}

export function requireEnv(name, env = process.env) {
  const value = env[name];
  if (!value) throw configurationError();
  return value;
}
