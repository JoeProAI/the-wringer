import crypto from "crypto";
import { requireEnv } from "./config-service.js";
import { ServiceError } from "./http-service.js";

const KEY_LIFETIME_MS = 5 * 60 * 60 * 1000;

export async function createRunKey({ sessionId, maxCostUsd }, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const managementKey = requireEnv("OPENROUTER_MANAGEMENT_KEY", env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now();
  const label = crypto.createHash("sha256").update(sessionId || crypto.randomUUID()).digest("hex").slice(0, 16);
  let response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `wringer-${label}`,
        limit: maxCostUsd,
        limit_reset: null,
        include_byok_in_limit: true,
        expires_at: new Date(now + KEY_LIFETIME_MS).toISOString(),
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ServiceError("MECHA_KEY_UNAVAILABLE", 503, "MECHA provider access is unavailable.");
  }
  if (response.status !== 201) {
    throw new ServiceError("MECHA_KEY_UNAVAILABLE", 503, "MECHA provider access is unavailable.");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError("MECHA_KEY_UNAVAILABLE", 503, "MECHA provider access is unavailable.");
  }
  if (
    typeof body?.key !== "string" ||
    !body.key.startsWith("sk-or-") ||
    body.key.length > 512 ||
    typeof body?.data?.hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.data.hash)
  ) {
    throw new ServiceError("MECHA_KEY_UNAVAILABLE", 503, "MECHA provider access is unavailable.");
  }
  return { key: body.key, hash: body.data.hash };
}

export async function revokeRunKey(hash, dependencies = {}) {
  if (!/^[a-f0-9]{64}$/.test(hash || "")) return false;
  const env = dependencies.env ?? process.env;
  const managementKey = requireEnv("OPENROUTER_MANAGEMENT_KEY", env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`https://openrouter.ai/api/v1/keys/${hash}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managementKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export const openRouterKeyInternals = { KEY_LIFETIME_MS };
