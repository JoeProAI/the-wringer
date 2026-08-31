import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDaytona } from "../daytona.js";
import { sendMechaDeliverable } from "../email.js";
import { RUNNER_SOURCE } from "../mecha-runner.js";
import { verifyAndConsume } from "../verify-payment.js";
import { isFreeMode, requireEnv } from "./config-service.js";
import { createRunKey, revokeRunKey } from "./openrouter-key-service.js";
import { parseCaseRequest, parseSessionId } from "./case-service.js";
import {
  assertPlainObject,
  boundedString,
  invalidRequest,
  ServiceError,
} from "./http-service.js";

const AUTO_STOP_MINUTES = 30;
const MAX_REPORT_BYTES = 10_000_000;
const EXPECTED_MECHA_PROFILE_VERSION = "2026.08.24.2";
const EXPECTED_MECHA_ARCHIVE_SHA256 = "e585bfea38bcef4eff2bdfbd055b5fbf7a337ca151938b322f2e740ed38b50f1";
const MECHA_TARBALL_B64 = fs.readFileSync(
  path.join(process.cwd(), "vendor", "mecha.tar.gz.b64"),
  "utf8"
);
const MECHA_MANIFEST = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "vendor", "mecha.manifest.json"), "utf8")
);
const MECHA_ARCHIVE_SHA256 = crypto
  .createHash("sha256")
  .update(Buffer.from(MECHA_TARBALL_B64, "base64"))
  .digest("hex");
if (
  MECHA_MANIFEST.profileId !== "wringer-cloud" ||
  MECHA_MANIFEST.profileVersion !== EXPECTED_MECHA_PROFILE_VERSION ||
  MECHA_MANIFEST.archiveSha256 !== EXPECTED_MECHA_ARCHIVE_SHA256 ||
  MECHA_ARCHIVE_SHA256 !== EXPECTED_MECHA_ARCHIVE_SHA256
) {
  throw new Error("MECHA cloud bundle manifest mismatch");
}

export function runOwnerHash(sessionId) {
  return crypto.createHash("sha256").update(sessionId || "free-mode").digest("hex");
}

function sandboxEnvironment(form, runDir, maxCostUsd, openRouterKey, env) {
  return Object.fromEntries(
    Object.entries({
      RUN_DIR: runDir,
      MECHA_CLOUD_PROFILE: "1",
      MECHA_CONTEXT_FILE: `${runDir}/context.json`,
      MECHA_RUN_MAX_USD: String(maxCostUsd),
      MECHA_OPENROUTER_MAX_TOKENS: "6000",
      MECHA_GAMMA_MAX_TOKENS: "4000",
      STRATEGY: form.mechaStrategy,
      AGENTS: String(form.mechaStrategy === "mega" ? form.mechaAgents : 0),
      MECHA_OPENROUTER_FORCE: "1",
      OPENROUTER_API_KEY: openRouterKey,
      MECHA_OPENROUTER_CLAUDE_MODEL: env.MECHA_OPENROUTER_CLAUDE_MODEL,
      MECHA_OPENROUTER_CODEX_MODEL: env.MECHA_OPENROUTER_CODEX_MODEL,
      GAMMA_APP_API_KEY: env.NODE_ENV === "production" ? undefined : env.GAMMA_APP_API_KEY,
      GAMMA_MODEL: env.GAMMA_MODEL,
    }).filter(([, value]) => typeof value === "string" && value.length > 0)
  );
}

async function revokeScopedKey(runKey, dependencies, env) {
  if (!runKey?.hash) return;
  await (dependencies.revokeRunKey ?? revokeRunKey)(runKey.hash, {
    env,
    fetchImpl: dependencies.openRouterFetch,
  });
}

export async function startMecha(body, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const freeMode = isFreeMode(env);
  const { sessionId, form, prompt } = parseCaseRequest(body, { sessionOptional: freeMode });
  const entitledAgents = form.mechaStrategy === "mega" ? form.mechaAgents : 4;
  const maxCostUsd = Math.min(45, Math.max(1, Math.round((entitledAgents * 0.4 + 1) * 100) / 100));
  let payment = null;
  if (!freeMode) {
    payment = await (dependencies.verifyAndConsume ?? verifyAndConsume)(sessionId, "mecha", {
      env,
      ...dependencies.paymentDependencies,
      expectedAgents: entitledAgents,
      allowLegacy: dependencies.sessionSource === "body",
      requireLegacy: dependencies.sessionSource === "body",
    });
    if (payment.replay) {
      if (payment.replay.kind !== "mecha") {
        throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
      }
      return {
        runId: payment.replay.runId,
        strategy: payment.replay.strategy,
        profileVersion: MECHA_MANIFEST.profileVersion,
        maxCostUsd,
      };
    }
  }

  const runKey = freeMode
    ? { key: requireEnv("OPENROUTER_API_KEY", env), hash: null }
    : await (dependencies.createRunKey ?? createRunKey)(
        { sessionId, maxCostUsd },
        { env, fetchImpl: dependencies.openRouterFetch }
      );
  if (!dependencies.daytona) requireEnv("DAYTONA_API_KEY", env);
  const daytona = dependencies.daytona ?? getDaytona();
  let sandbox;
  try {
    sandbox = await daytona.create({
      autoStopInterval: AUTO_STOP_MINUTES,
      autoDeleteInterval: 240,
      labels: {
        platform: "the-wringer",
        purpose: "mecha-run",
        "mecha-profile": String(MECHA_MANIFEST.profileVersion).slice(0, 60),
        "owner-hash": runOwnerHash(sessionId),
        ...(runKey.hash ? { "openrouter-key-hash": runKey.hash } : {}),
      },
    });
  } catch {
    await revokeScopedKey(runKey, dependencies, env);
    throw new ServiceError("MECHA_UNAVAILABLE", 502, "MECHA service is unavailable.");
  }

  try {
    const rootDir = (await sandbox.getUserRootDir()) || "/home/daytona";
    const runDir = `${rootDir.replace(/\/$/, "")}/wringer`;
    await sandbox.fs.createFolder(runDir, "700");
    await sandbox.fs.uploadFiles([
      { source: Buffer.from(MECHA_TARBALL_B64, "utf8"), destination: `${runDir}/mecha.tar.gz.b64` },
      { source: Buffer.from(prompt, "utf8"), destination: `${runDir}/task.txt` },
      {
        source: Buffer.from(JSON.stringify({ schemaVersion: 1, trust: "customer-supplied", source: "the-wringer", content: prompt }), "utf8"),
        destination: `${runDir}/context.json`,
      },
      { source: Buffer.from(RUNNER_SOURCE, "utf8"), destination: `${runDir}/runner.sh` },
    ]);
    const start = await sandbox.process.executeCommand(
      "nohup bash runner.sh > runner.log 2>&1 & echo MECHA_STARTED",
      runDir,
      sandboxEnvironment(form, runDir, maxCostUsd, runKey.key, env)
    );
    if (start.exitCode !== 0 || !String(start.result).includes("MECHA_STARTED")) {
      throw new Error("runner did not start");
    }
    const result = {
      runId: sandbox.id,
      strategy: form.mechaStrategy,
      profileVersion: MECHA_MANIFEST.profileVersion,
      maxCostUsd,
    };
    if (payment) {
      await payment.ledger.completeMecha(payment.claim, result);
    }
    return result;
  } catch {
    await revokeScopedKey(runKey, dependencies, env);
    try {
      await sandbox.delete();
    } catch {}
    throw new ServiceError("MECHA_UNAVAILABLE", 502, "MECHA service is unavailable.");
  }
}

function parseStatusRequest(body, freeMode) {
  const value = assertPlainObject(body, ["runId", "sessionId"]);
  const runId = boundedString(value.runId, { min: 1, max: 128 });
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) throw invalidRequest();
  return {
    runId,
    sessionId: parseSessionId(value.sessionId, { optional: freeMode }),
  };
}

function safeGammaUrl(value, allowedHosts) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function readReport(sandbox, runDir) {
  try {
    const buffer = await sandbox.fs.downloadFile(`${runDir}/report.json`);
    if (!buffer || buffer.length > MAX_REPORT_BYTES) return null;
    const report = JSON.parse(buffer.toString("utf8"));
    if (!report || typeof report !== "object" || Array.isArray(report)) return null;
    return {
      ...report,
      gamma_presentation_url: safeGammaUrl(report.gamma_presentation_url, ["gamma.app", "www.gamma.app"]),
      gamma_export_url: safeGammaUrl(report.gamma_export_url, ["assets.api.gamma.app"]),
    };
  } catch {
    return null;
  }
}

export async function getMechaStatus(body, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const freeMode = isFreeMode(env);
  const { runId, sessionId } = parseStatusRequest(body, freeMode);
  if (!dependencies.daytona) requireEnv("DAYTONA_API_KEY", env);
  const daytona = dependencies.daytona ?? getDaytona();
  let sandbox;
  try {
    sandbox = await daytona.get(runId);
  } catch {
    throw new ServiceError("RUN_NOT_FOUND", 404, "Run not found.");
  }

  const labels = sandbox.labels ?? {};
  if (
    labels.platform !== "the-wringer" ||
    labels.purpose !== "mecha-run" ||
    labels["owner-hash"] !== runOwnerHash(sessionId)
  ) {
    throw new ServiceError("RUN_NOT_FOUND", 404, "Run not found.");
  }

  const rootDir = (await sandbox.getUserRootDir()) || "/home/daytona";
  const runDir = `${rootDir.replace(/\/$/, "")}/wringer`;
  let progress = [];
  let report = null;
  if (sandbox.state === "started") {
    try {
      const result = await sandbox.process.executeCommand(
        "tail -n 200 mecha/state/events.jsonl 2>/dev/null",
        runDir
      );
      progress = String(result.result || "")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {}
  }
  report = await readReport(sandbox, runDir);

  let emailSent = labels["email-sent"] === "true";
  if (report && sessionId && !emailSent) {
    try {
      await sandbox.fs.downloadFile(`${runDir}/.email-sent`);
      emailSent = true;
    } catch {}

    if (!emailSent) {
      const emailResult = await (dependencies.sendMechaDeliverable ?? sendMechaDeliverable)({
        report,
        sessionId,
        runId,
      });
      emailSent = emailResult.sent;
      if (emailResult.sent) {
        try {
          await sandbox.fs.uploadFile(Buffer.from("sent", "utf8"), `${runDir}/.email-sent`);
        } catch {}
        try {
          await sandbox.setLabels({ ...labels, "email-sent": "true" });
        } catch {}
      }
    }
  }

  if (report && labels["openrouter-key-hash"]) {
    await (dependencies.revokeRunKey ?? revokeRunKey)(labels["openrouter-key-hash"], {
      env,
      fetchImpl: dependencies.openRouterFetch,
    });
  }

  if (report && sandbox.state === "started") {
    try {
      await sandbox.stop();
    } catch {}
  }

  return {
    done: Boolean(report),
    progress,
    report,
    emailSent: emailSent || labels["email-sent"] === "true",
  };
}
