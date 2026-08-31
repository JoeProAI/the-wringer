import crypto from "crypto";
import { configurationError, ServiceError } from "./http-service.js";

const PENDING_TTL_SECONDS = 10 * 60;
const COMPLETED_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;
const AUDIT_RESULT_TTL_SECONDS = 24 * 60 * 60;
const MAX_AUDIT_OUTPUT_CHARS = 100_000;
const COMPLETE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current ~= ARGV[1] then return 0 end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

function redisConfiguration(env) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw configurationError();
  }
  let url;
  try {
    url = new URL(env.UPSTASH_REDIS_REST_URL);
  } catch {
    throw configurationError();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw configurationError();
  }
  return {
    url: url.toString().replace(/\/$/, ""),
    token: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

function entitlementData(entitlement) {
  return {
    tier: entitlement.tier,
    amountCents: entitlement.amountCents,
    currency: entitlement.currency,
    agents: entitlement.agents,
  };
}

function sameEntitlement(record, entitlement) {
  const expected = entitlementData(entitlement);
  return Object.entries(expected).every(([key, value]) => record.entitlement?.[key] === value);
}

function ledgerKey(sessionId) {
  const digest = crypto.createHash("sha256").update(sessionId).digest("hex");
  return `wringer:payment:v2:${digest}`;
}

export function createRedisClaimLedger({ env = process.env, fetchImpl = fetch, randomUUID = crypto.randomUUID } = {}) {
  const config = redisConfiguration(env);

  const command = async (parts) => {
    let response;
    try {
      response = await fetchImpl(config.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parts),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
    if (!response.ok) {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
    try {
      const body = await response.json();
      if (!Object.prototype.hasOwnProperty.call(body, "result") || body.error) throw new Error("invalid Redis response");
      return body.result;
    } catch {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
  };

  const readRecord = async (key) => {
    const value = await command(["GET", key]);
    if (typeof value !== "string") {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
    try {
      const record = JSON.parse(value);
      if (!record || typeof record !== "object") throw new Error("invalid record");
      return record;
    } catch {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
  };

  const complete = async (claim, result) => {
    const record = {
      version: 2,
      status: "completed",
      entitlement: entitlementData(claim.entitlement),
      ...result,
    };
    const updated = await command([
      "EVAL",
      COMPLETE_SCRIPT,
      "1",
      claim.key,
      claim.pendingValue,
      JSON.stringify(record),
      String(COMPLETED_TTL_SECONDS),
    ]);
    if (updated !== 1) {
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    }
  };

  return {
    async begin(entitlement) {
      const key = ledgerKey(entitlement.sessionId);
      const claimToken = randomUUID();
      const pending = JSON.stringify({
        version: 2,
        status: "pending",
        claimToken,
        entitlement: entitlementData(entitlement),
      });
      const created = await command([
        "SET",
        key,
        pending,
        "NX",
        "EX",
        String(PENDING_TTL_SECONDS),
      ]);
      if (created === "OK") {
        return { status: "claimed", key, claimToken, pendingValue: pending, entitlement };
      }
      if (created !== null) {
        throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
      }

      const record = await readRecord(key);
      if (!sameEntitlement(record, entitlement)) {
        throw new ServiceError("PAYMENT_INVALID", 402, "Payment is invalid or incomplete.");
      }
      if (record.status === "pending") {
        throw new ServiceError("PAYMENT_PENDING", 409, "Payment request is already in progress.");
      }
      if (record.status !== "completed") {
        throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
      }
      if (record.kind === "audit") {
        const cached = await command(["GET", `${key}:result`]);
        if (cached === null) {
          throw new ServiceError("PAYMENT_USED", 409, "Payment has already been used.");
        }
        try {
          const result = JSON.parse(cached);
          if (
            typeof result.output !== "string" ||
            result.output.length > MAX_AUDIT_OUTPUT_CHARS ||
            typeof result.model !== "string" ||
            result.model.length > 200
          ) {
            throw new Error("invalid audit result");
          }
          return { status: "completed", kind: "audit", output: result.output, model: result.model };
        } catch (error) {
          if (error instanceof ServiceError) throw error;
          throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
        }
      }
      if (
        record.kind === "mecha" &&
        typeof record.runId === "string" &&
        record.runId.length <= 128 &&
        typeof record.strategy === "string" &&
        record.strategy.length <= 32
      ) {
        return { status: "completed", kind: "mecha", runId: record.runId, strategy: record.strategy };
      }
      throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
    },

    async completeAudit(claim, { output, model }) {
      if (
        typeof output !== "string" ||
        output.length > MAX_AUDIT_OUTPUT_CHARS ||
        typeof model !== "string" ||
        model.length > 200
      ) {
        throw new ServiceError("AUDIT_UNAVAILABLE", 502, "Audit service is unavailable.");
      }
      await command([
        "SET",
        `${claim.key}:result`,
        JSON.stringify({ output, model }),
        "EX",
        String(AUDIT_RESULT_TTL_SECONDS),
      ]);
      await complete(claim, { kind: "audit" });
    },

    async completeMecha(claim, { runId, strategy }) {
      if (
        typeof runId !== "string" ||
        !/^[A-Za-z0-9._-]{1,128}$/.test(runId) ||
        typeof strategy !== "string" ||
        strategy.length > 32
      ) {
        throw new ServiceError("MECHA_UNAVAILABLE", 502, "MECHA service is unavailable.");
      }
      await complete(claim, { kind: "mecha", runId, strategy });
    },
  };
}

export const paymentLedgerInternals = {
  PENDING_TTL_SECONDS,
  COMPLETED_TTL_SECONDS,
  AUDIT_RESULT_TTL_SECONDS,
  MAX_AUDIT_OUTPUT_CHARS,
  ledgerKey,
};
