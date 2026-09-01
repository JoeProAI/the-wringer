import assert from "node:assert/strict";
import { buildContract } from "../lib/protocol.js";
import { compileCase, MAX_COMPILED_CASE_CHARS } from "../lib/services/case-service.js";
import { getSiteUrl, isFreeMode } from "../lib/services/config-service.js";
import { runAudit } from "../lib/services/audit-service.js";
import { completeCheckoutCallback } from "../lib/services/checkout-callback-service.js";
import { createCheckout } from "../lib/services/checkout-service.js";
import { entitlementMetadata, getEntitlement } from "../lib/services/entitlement-service.js";
import { handleJsonPost, PAYMENT_SESSION_COOKIE } from "../lib/services/http-service.js";
import {
  CHECKOUT_NONCE_COOKIE,
  checkoutNonceHash,
  requireCookieSecret,
  signPaymentSession,
} from "../lib/services/payment-cookie-service.js";
import { createRedisClaimLedger } from "../lib/services/payment-claim-service.js";
import { getMechaStatus, runOwnerHash, startMecha } from "../lib/services/mecha-service.js";
import { createRunKey } from "../lib/services/openrouter-key-service.js";
import { verifyAndConsume } from "../lib/verify-payment.js";

const expectCode = async (operation, code) => {
  try {
    await operation();
    assert.fail(`expected ${code}`);
  } catch (error) {
    assert.equal(error.code, code);
  }
};

const baseForm = {
  goal: "Ship <safe> & verified <!-- injected -->",
  acs: [{ text: "Output has </ac><evil> no injection --", kind: "AUTO", check: "x\" y", expect: "ok & done" }],
  nonGoals: "No <deploy>",
  maxIterations: 30,
  preauthorized: "Nothing <!-- close -->",
  mechaStrategy: "triumvirate",
  mechaAgents: 24,
};

const contract = buildContract(baseForm);
assert.equal(contract.includes("<!--"), false);
assert.equal(contract.includes("<evil>"), false);
assert.match(contract, /&lt;evil&gt;/);
assert.match(contract, /&quot;/);
const controlSafe = buildContract({ ...baseForm, goal: "bad\u0000surrogate\ud800" });
assert.equal(controlSafe.includes("\u0000"), false);
assert.equal(controlSafe.includes("\ud800"), false);
const compiled = compileCase(baseForm).prompt;
assert.ok(compiled.length <= MAX_COMPILED_CASE_CHARS);
await expectCode(
  () => compileCase({ ...baseForm, unexpected: true }),
  "INVALID_REQUEST"
);
await expectCode(
  () => compileCase({
    ...baseForm,
    acs: Array.from({ length: 20 }, (_, index) => ({
      text: `criterion-${index}-${"x".repeat(1900)}`,
      kind: "AUTO",
      check: "y".repeat(1900),
      expect: "z".repeat(1900),
    })),
  }),
  "INVALID_REQUEST"
);

assert.equal(getSiteUrl({ NODE_ENV: "development", SITE_URL: "https://EXAMPLE.com:443/" }), "https://example.com");
await expectCode(() => getSiteUrl({ NODE_ENV: "production", SITE_URL: "http://example.com" }), "CONFIGURATION_ERROR");
await expectCode(() => isFreeMode({ NODE_ENV: "production", FREE_MODE: "true" }), "CONFIGURATION_ERROR");

let checkoutParams;
const checkoutEnv = {
  NODE_ENV: "production",
  SITE_URL: "https://thewringer.ai/",
  STRIPE_SECRET_KEY: "mock",
  WRINGER_COOKIE_SECRET: "0123456789abcdef0123456789abcdef",
  MECHA_PRICE_CENTS: "1000",
  MEGA_PRICE_PER_AGENT_CENTS: "35",
  MEGA_PRICE_CAP_CENTS: "4000",
};
const checkout = await createCheckout(
  { tier: "mecha", agents: 25 },
  {
    env: checkoutEnv,
    randomBytes: () => Buffer.alloc(32, 7),
    stripe: {
      checkout: {
        sessions: {
          create: async (params) => {
            checkoutParams = params;
            return { url: "https://checkout.example/session" };
          },
        },
      },
    },
  }
);
assert.equal(checkout.body.url, "https://checkout.example/session");
const checkoutNonce = Buffer.alloc(32, 7).toString("base64url");
assert.deepEqual(checkout.cookies[0], {
  name: CHECKOUT_NONCE_COOKIE,
  value: checkoutNonce,
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/api/checkout/callback",
  maxAge: 600,
});
assert.equal(
  checkoutParams.success_url,
  "https://thewringer.ai/api/checkout/callback?session_id={CHECKOUT_SESSION_ID}&tier=mecha"
);
assert.equal(checkoutParams.success_url.includes("/?session_id="), false);
assert.equal(checkoutParams.metadata.wringer_schema, "2");
assert.equal(checkoutParams.metadata.wringer_checkout_nonce_hash, checkoutNonceHash(checkoutNonce));
assert.equal(checkoutParams.payment_intent_data.metadata.wringer_checkout_nonce_hash, undefined);
assert.equal(JSON.stringify(checkoutParams.metadata).includes(checkoutNonce), false);
assert.equal(checkoutParams.metadata.wringer_agents, "25");
assert.equal(checkoutParams.metadata.wringer_amount_cents, "1735");
assert.equal(checkoutParams.metadata.wringer_currency, "usd");
const checkoutResponse = await handleJsonPost(
  new Request("https://evil.example/api/checkout", {
    method: "POST",
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ tier: "mecha", agents: 25 }),
  }),
  async () => checkout
);
assert.deepEqual(await checkoutResponse.json(), { url: "https://checkout.example/session" });
const nonceSetCookie = checkoutResponse.headers.get("set-cookie");
assert.match(nonceSetCookie, new RegExp(`^${CHECKOUT_NONCE_COOKIE}=`));
assert.match(nonceSetCookie, /HttpOnly/i);
assert.match(nonceSetCookie, /Secure/i);
assert.match(nonceSetCookie, /SameSite=lax/i);
assert.match(nonceSetCookie, /Path=\/api\/checkout\/callback/i);
assert.equal(nonceSetCookie.includes("thewringer.ai"), false);

const paymentEnv = { PRICE_CENTS: "100", STRIPE_SECRET_KEY: "mock" };
const auditEntitlement = getEntitlement("audit", undefined, paymentEnv);
const metadata = entitlementMetadata(auditEntitlement);
const validSession = {
  id: "cs_test_security",
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  currency: "usd",
  amount_subtotal: 100,
  amount_total: 100,
  metadata,
  line_items: { data: [{ quantity: 1, currency: "usd", amount_subtotal: 100 }] },
  payment_intent: {
    status: "succeeded",
    currency: "usd",
    amount: 100,
    amount_received: 100,
    metadata,
  },
};
let claims = 0;
const stripe = { checkout: { sessions: { retrieve: async () => validSession } } };
const verified = await verifyAndConsume("cs_test_security", "audit", {
  env: paymentEnv,
  stripe,
  expectedAgents: 0,
  ledger: { begin: async (entitlement) => { claims += 1; return { status: "claimed", entitlement }; } },
});
assert.equal(verified.ok, true);
assert.equal(claims, 1);
await expectCode(
  () => verifyAndConsume("cs_test_security", "audit", {
    env: paymentEnv,
    stripe: { checkout: { sessions: { retrieve: async () => ({ ...validSession, amount_subtotal: 99 }) } } },
    ledger: { begin: async () => { claims += 1; return { status: "claimed" }; } },
  }),
  "PAYMENT_INVALID"
);
assert.equal(claims, 1);
const legacySession = {
  ...validSession,
  metadata: { wringer_tier: "audit" },
  payment_intent: { ...validSession.payment_intent, metadata: { wringer_tier: "audit" } },
};
await expectCode(
  () => verifyAndConsume("cs_test_legacy", "audit", {
    env: paymentEnv,
    stripe: { checkout: { sessions: { retrieve: async () => legacySession } } },
    ledger: { begin: async () => assert.fail("non-compatible source reached ledger") },
  }),
  "PAYMENT_INVALID"
);
const legacyVerified = await verifyAndConsume("cs_test_legacy", "audit", {
  env: paymentEnv,
  allowLegacy: true,
  stripe: { checkout: { sessions: { retrieve: async () => legacySession } } },
  ledger: { begin: async (entitlement) => ({ status: "claimed", entitlement }) },
});
assert.equal(legacyVerified.entitlement.legacy, true);

const redisValues = new Map();
const redisCommands = [];
const redisFetch = async (_url, options) => {
  const command = JSON.parse(options.body);
  redisCommands.push(command);
  if (command[0] === "SET") {
    if (command.includes("NX") && redisValues.has(command[1])) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    redisValues.set(command[1], command[2]);
    return { ok: true, json: async () => ({ result: "OK" }) };
  }
  if (command[0] === "GET") {
    return { ok: true, json: async () => ({ result: redisValues.get(command[1]) ?? null }) };
  }
  if (command[0] === "EVAL") {
    if (redisValues.get(command[3]) !== command[4]) {
      return { ok: true, json: async () => ({ result: 0 }) };
    }
    redisValues.set(command[3], command[5]);
    return { ok: true, json: async () => ({ result: 1 }) };
  }
  assert.fail(`unexpected Redis command ${command[0]}`);
};
const redisEnv = {
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
};
assert.ok(createRedisClaimLedger({
  env: { KV_REST_API_URL: "https://redis.example", KV_REST_API_TOKEN: "redis-token" },
  fetchImpl: redisFetch,
}));
const ledger = createRedisClaimLedger({ env: redisEnv, fetchImpl: redisFetch, randomUUID: () => "claim-audit" });
const concurrent = await Promise.allSettled([
  ledger.begin({ ...auditEntitlement, sessionId: "cs_test_concurrent" }),
  ledger.begin({ ...auditEntitlement, sessionId: "cs_test_concurrent" }),
]);
assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(concurrent.find((result) => result.status === "rejected").reason.code, "PAYMENT_PENDING");
const auditClaim = await ledger.begin({ ...auditEntitlement, sessionId: "cs_test_atomic" });
assert.equal(auditClaim.status, "claimed");
await expectCode(
  () => ledger.begin({ ...auditEntitlement, sessionId: "cs_test_atomic" }),
  "PAYMENT_PENDING"
);
await ledger.completeAudit(auditClaim, { output: "cached result", model: "mock/model" });
const auditReplay = await ledger.begin({ ...auditEntitlement, sessionId: "cs_test_atomic" });
assert.deepEqual(
  { kind: auditReplay.kind, output: auditReplay.output, model: auditReplay.model },
  { kind: "audit", output: "cached result", model: "mock/model" }
);
assert.equal(redisCommands[0][0], "SET");
assert.equal(redisCommands[0].includes("NX"), true);
assert.equal(redisCommands[0].includes("EX"), true);
assert.equal(JSON.stringify(redisCommands).includes("redis-token"), false);

const mechaEntitlement = getEntitlement("mecha", undefined, checkoutEnv);
const mechaClaim = await ledger.begin({ ...mechaEntitlement, sessionId: "cs_test_mecha_atomic" });
await ledger.completeMecha(mechaClaim, { runId: "run-stable", strategy: "triumvirate" });
const mechaReplay = await ledger.begin({ ...mechaEntitlement, sessionId: "cs_test_mecha_atomic" });
assert.deepEqual(
  { kind: mechaReplay.kind, runId: mechaReplay.runId, strategy: mechaReplay.strategy },
  { kind: "mecha", runId: "run-stable", strategy: "triumvirate" }
);
await expectCode(
  () => Promise.resolve(createRedisClaimLedger({ env: {} })),
  "CONFIGURATION_ERROR"
);

const cachedAudit = await runAudit(
  { sessionId: "cs_test_cached", form: baseForm },
  {
    env: { NODE_ENV: "production" },
    sessionSource: "cookie",
    verifyAndConsume: async () => ({ replay: { kind: "audit", output: "cached", model: "cached/model" } }),
    fetchImpl: async () => assert.fail("cached audit called provider"),
  }
);
assert.deepEqual(cachedAudit, { output: "cached", model: "cached/model" });

const replayedMecha = await startMecha(
  { sessionId: "cs_test_mecha_replay", form: baseForm },
  {
    env: { NODE_ENV: "production" },
    sessionSource: "cookie",
    verifyAndConsume: async () => ({ replay: { kind: "mecha", runId: "run-stable", strategy: "triumvirate" } }),
    daytona: { create: async () => assert.fail("replayed MECHA created a sandbox") },
  }
);
assert.deepEqual(replayedMecha, {
  runId: "run-stable",
  strategy: "triumvirate",
  profileVersion: "2026.08.24.2",
  maxCostUsd: 2.6,
});

assert.equal(
  requireCookieSecret({ WRINGER_PREVIEW_COOKIE_SECRET: "preview-secret-0123456789abcdefghijkl" }),
  "preview-secret-0123456789abcdefghijkl"
);
const cookieEnv = {
  NODE_ENV: "production",
  SITE_URL: "https://thewringer.ai",
  WRINGER_COOKIE_SECRET: "0123456789abcdef0123456789abcdef",
};
const callbackUrl = "https://evil.example/api/checkout/callback?session_id=cs_test_cookie&tier=audit";
const callbackDependencies = {
  env: cookieEnv,
  verifyPayment: async (_sessionId, _tier, options) => {
    assert.equal(options.allowLegacy, false);
    return { checkoutNonceHash: checkoutNonceHash(checkoutNonce) };
  },
};
await expectCode(
  () => completeCheckoutCallback(new Request(callbackUrl), callbackDependencies),
  "INVALID_REQUEST"
);
await expectCode(
  () => completeCheckoutCallback(
    new Request(callbackUrl, { headers: { Cookie: `${CHECKOUT_NONCE_COOKIE}=wrong-nonce-value-that-is-long-enough` } }),
    callbackDependencies
  ),
  "INVALID_REQUEST"
);
const callback = await completeCheckoutCallback(
  new Request(callbackUrl, {
    headers: {
      Origin: "https://evil.example",
      Cookie: `${CHECKOUT_NONCE_COOKIE}=${checkoutNonce}`,
    },
  }),
  callbackDependencies
);
assert.equal(callback.status, 303);
assert.equal(callback.headers.get("location"), "https://thewringer.ai/?tier=audit&paid=1");
assert.equal(callback.headers.get("location").includes("cs_test_cookie"), false);
const setCookie = callback.headers.get("set-cookie");
const signedSession = signPaymentSession("cs_test_cookie", cookieEnv);
assert.match(setCookie, new RegExp(`${PAYMENT_SESSION_COOKIE}=${signedSession}`));
assert.match(setCookie, /HttpOnly/i);
assert.match(setCookie, /Secure/i);
assert.match(setCookie, /SameSite=strict/i);
assert.match(setCookie, /Path=\/api/i);
assert.match(setCookie, new RegExp(`${CHECKOUT_NONCE_COOKIE}=;`));
assert.match(setCookie, /Max-Age=0/i);

let cookieAdapterContext;
const cookieAdapterResponse = await handleJsonPost(
  new Request("https://thewringer.ai/api/run", {
    method: "POST",
    headers: { Cookie: `${PAYMENT_SESSION_COOKIE}=${signedSession}`, "Content-Type": "application/json" },
    body: JSON.stringify({ form: baseForm }),
  }),
  async (body, context) => {
    cookieAdapterContext = context;
    return { sessionId: body.sessionId };
  },
  { paymentCookie: true, env: cookieEnv }
);
assert.equal((await cookieAdapterResponse.json()).sessionId, "cs_test_cookie");
assert.equal(cookieAdapterContext.sessionSource, "cookie");
let tamperedCookieAccepted = false;
const tamperedSession = `${signedSession.slice(0, -1)}${signedSession.endsWith("0") ? "1" : "0"}`;
const tamperedResponse = await handleJsonPost(
  new Request("https://thewringer.ai/api/run", {
    method: "POST",
    headers: { Cookie: `${PAYMENT_SESSION_COOKIE}=${tamperedSession}`, "Content-Type": "application/json" },
    body: JSON.stringify({ form: baseForm }),
  }),
  async () => {
    tamperedCookieAccepted = true;
    return {};
  },
  { paymentCookie: true, env: cookieEnv }
);
assert.equal(tamperedResponse.status, 400);
assert.equal(tamperedCookieAccepted, false);

let keyRequest;
const scopedKey = await createRunKey(
  { sessionId: "cs_test_scoped", maxCostUsd: 5 },
  {
    env: { OPENROUTER_MANAGEMENT_KEY: "management-secret" },
    now: 1_800_000_000_000,
    fetchImpl: async (_url, options) => {
      keyRequest = options;
      return {
        status: 201,
        json: async () => ({ key: "sk-or-v1-scoped", data: { hash: "a".repeat(64) } }),
      };
    },
  }
);
assert.equal(scopedKey.key, "sk-or-v1-scoped");
assert.equal(JSON.parse(keyRequest.body).limit, 5);
assert.equal(keyRequest.body.includes("management-secret"), false);
let revokedFailedStart = 0;
await expectCode(
  () => startMecha(
    { sessionId: "cs_test_failed_start", form: baseForm },
    {
      env: { NODE_ENV: "production" },
      sessionSource: "cookie",
      verifyAndConsume: async () => ({ replay: null }),
      createRunKey: async () => ({ key: "sk-or-v1-scoped", hash: "b".repeat(64) }),
      revokeRunKey: async () => { revokedFailedStart += 1; return true; },
      daytona: { create: async () => { throw new Error("unavailable"); } },
    }
  ),
  "MECHA_UNAVAILABLE"
);
assert.equal(revokedFailedStart, 1);

let startCommand;
const startSandbox = {
  id: "run-started",
  getUserRootDir: async () => "/home/daytona",
  fs: {
    createFolder: async () => {},
    uploadFiles: async () => {},
  },
  process: {
    executeCommand: async (...args) => {
      startCommand = args;
      return { exitCode: 0, result: "MECHA_STARTED" };
    },
  },
  delete: async () => assert.fail("successful sandbox deleted"),
};
await startMecha(
  { sessionId: null, form: { ...baseForm, goal: "Safe start" } },
  {
    env: {
      NODE_ENV: "development",
      FREE_MODE: "true",
      OPENROUTER_API_KEY: "secret-with-$-quotes-\"-'",
      GAMMA_MODEL: "mock/gamma-model",
    },
    daytona: { create: async () => startSandbox },
  }
);
assert.equal(startCommand[0].includes("secret-with"), false);
assert.equal(startCommand[2].OPENROUTER_API_KEY, "secret-with-$-quotes-\"-'");
assert.equal(startCommand[2].GAMMA_MODEL, "mock/gamma-model");
assert.equal(startCommand[2].MECHA_CLOUD_PROFILE, "1");

const stoppedSandbox = {
  state: "stopped",
  labels: {
    platform: "the-wringer",
    purpose: "mecha-run",
    "owner-hash": runOwnerHash("cs_test_security"),
  },
  getUserRootDir: async () => "/home/daytona",
  fs: { downloadFile: async () => { throw new Error("offline"); } },
  process: { executeCommand: async () => assert.fail("stopped sandbox executed a command") },
  start: async () => assert.fail("status restarted a sandbox"),
};
const status = await getMechaStatus(
  { runId: "run-123", sessionId: "cs_test_security" },
  { env: { NODE_ENV: "production" }, daytona: { get: async () => stoppedSandbox } }
);
assert.equal(status.done, false);
const reportSandbox = {
  ...stoppedSandbox,
  fs: {
    downloadFile: async (file) => {
      if (!file.endsWith("report.json")) throw new Error("missing");
      return Buffer.from(JSON.stringify({
        exit_code: 0,
        gamma_presentation_url: "javascript:alert(1)",
        gamma_export_url: "https://evil.example/report.pdf",
      }));
    },
  },
};
const safeStatus = await getMechaStatus(
  { runId: "run-123", sessionId: "cs_test_security" },
  {
    env: { NODE_ENV: "production" },
    daytona: { get: async () => reportSandbox },
    sendMechaDeliverable: async () => ({ sent: false }),
  }
);
assert.equal(safeStatus.report.gamma_presentation_url, null);
assert.equal(safeStatus.report.gamma_export_url, null);
await expectCode(
  () => getMechaStatus(
    { runId: "run-123", sessionId: "cs_test_other" },
    { env: { NODE_ENV: "production" }, daytona: { get: async () => stoppedSandbox } }
  ),
  "RUN_NOT_FOUND"
);

console.log("SECURITY_SMOKE_OK");
