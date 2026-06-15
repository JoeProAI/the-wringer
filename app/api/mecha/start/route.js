import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { buildPrompt } from "../../../../lib/protocol";
import { verifyAndConsume } from "../../../../lib/verify-payment";
import { RUNNER_SOURCE, MECHA_STRATEGIES } from "../../../../lib/mecha-runner";
import { getDaytona } from "../../../../lib/daytona";

const AUTO_STOP_MINUTES = 30;
const MECHA_TARBALL_B64 = fs.readFileSync(
  path.join(process.cwd(), "vendor", "mecha.tar.gz.b64"),
  "utf8"
);

export async function POST(req) {
  const body = await req.json();
  const { sessionId, form } = body || {};
  if (!form || !form.goal || !String(form.goal).trim()) {
    return NextResponse.json({ error: "Missing goal" }, { status: 400 });
  }

  // Infinity until a payment gate proves otherwise (FREE_MODE / local demo).
  let paidAgents = Infinity;
  if (process.env.FREE_MODE !== "true") {
    const v = await verifyAndConsume(sessionId, "mecha");
    if (v?.error) return NextResponse.json({ error: v.error }, { status: v.status });
    paidAgents = v.paidAgents;
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });
  }

  const daytona = getDaytona();
  const sandbox = await daytona.create({
    autoStopInterval: AUTO_STOP_MINUTES,
    autoDeleteInterval: 240,
    labels: {
      platform: "the-wringer",
      purpose: "mecha-run",
      "stripe-session": sessionId ? String(sessionId).slice(0, 60) : "free-mode",
    },
  });

  try {
    const rootDir = (await sandbox.getUserRootDir()) || "/home/daytona";
    const runDir = `${rootDir.replace(/\/$/, "")}/wringer`;

    const upload = async (name, content) => {
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const res = await sandbox.process.executeCommand(
        `mkdir -p "${runDir}" && echo '${b64}' | base64 -d > "${runDir}/${name}"`
      );
      if (res.exitCode !== 0) throw new Error(`upload ${name} failed: ${res.result}`);
    };
    await upload("mecha.tar.gz.b64", MECHA_TARBALL_B64);
    await upload("task.txt", buildPrompt(form));
    await upload("runner.sh", RUNNER_SOURCE);

    const strategy = MECHA_STRATEGIES.includes(form.mechaStrategy)
      ? form.mechaStrategy
      : "triumvirate";
    // Mega runs carry an agent count (clamped 3..100); every other strategy
    // ignores AGENTS (0 = strategy default).
    let agents = 0;
    if (strategy === "mega") {
      const n = parseInt(form.mechaAgents, 10);
      agents = Number.isFinite(n) ? Math.max(3, Math.min(100, n)) : 12;
      // Never run more agents than the session was charged for: blocks a cheap
      // ($10/base) session being replayed as a high Mega tier.
      agents = Math.min(agents, paidAgents);
    }
    const env = [
      `RUN_DIR="${runDir}"`,
      `STRATEGY="${strategy}"`,
      `AGENTS="${agents}"`,
      `MECHA_OPENROUTER_FORCE="1"`,
      `OPENROUTER_API_KEY="${process.env.OPENROUTER_API_KEY}"`,
      process.env.XAI_API_KEY ? `XAI_API_KEY="${process.env.XAI_API_KEY}"` : "",
      process.env.MECHA_OPENROUTER_CLAUDE_MODEL
        ? `MECHA_OPENROUTER_CLAUDE_MODEL="${process.env.MECHA_OPENROUTER_CLAUDE_MODEL}"`
        : "",
      process.env.MECHA_OPENROUTER_CODEX_MODEL
        ? `MECHA_OPENROUTER_CODEX_MODEL="${process.env.MECHA_OPENROUTER_CODEX_MODEL}"`
        : "",
      process.env.GAMMA_APP_API_KEY
        ? `GAMMA_APP_API_KEY="${process.env.GAMMA_APP_API_KEY}"`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const start = await sandbox.process.executeCommand(
      `${env} nohup bash "${runDir}/runner.sh" > "${runDir}/runner.log" 2>&1 & echo MECHA_STARTED`
    );
    if (!String(start.result).includes("MECHA_STARTED")) {
      throw new Error(`start failed: ${start.result}`);
    }
    return NextResponse.json({ runId: sandbox.id, strategy });
  } catch (e) {
    try {
      await sandbox.delete();
    } catch {}
    return NextResponse.json({ error: `MECHA start failed: ${String(e).slice(0, 300)}` }, { status: 502 });
  }
}

export const maxDuration = 60;
