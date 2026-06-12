import Stripe from "stripe";
import { NextResponse } from "next/server";
import { buildPrompt } from "../../../../lib/protocol";
import { HARNESS_SOURCE } from "../../../../lib/harness";
import { getDaytona } from "../../../../lib/daytona";

const AUTO_STOP_MINUTES = 30;

export async function POST(req) {
  const body = await req.json();
  const { sessionId, form } = body || {};
  if (!form || !form.goal || !String(form.goal).trim()) {
    return NextResponse.json({ error: "Missing goal" }, { status: 400 });
  }

  if (process.env.FREE_MODE !== "true") {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
    if (pi.metadata?.wringer_tier !== "mecha") {
      return NextResponse.json({ error: "This payment is for the audit tier, not MECHA RUN." }, { status: 402 });
    }
    if (pi.metadata?.wringer_used === "true") {
      return NextResponse.json({ error: "This run was already used. Pay for another run." }, { status: 402 });
    }
    await stripe.paymentIntents.update(session.payment_intent, {
      metadata: { wringer_used: "true", wringer_tier: "mecha" },
    });
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
    const contract = { systemPrompt: buildPrompt(form), form };

    const upload = async (path, content) => {
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const res = await sandbox.process.executeCommand(
        `mkdir -p "${runDir}" && echo '${b64}' | base64 -d > "${runDir}/${path}"`
      );
      if (res.exitCode !== 0) throw new Error(`upload ${path} failed: ${res.result}`);
    };
    await upload("contract.json", JSON.stringify(contract));
    await upload("harness.js", HARNESS_SOURCE);

    const model = form.mechaModel || process.env.MECHA_MODEL || "x-ai/grok-4.3";
    const env = [
      `WRINGER_DIR="${runDir}"`,
      `WORKSPACE_DIR="${runDir}/work"`,
      `MODEL="${String(model).replace(/[^a-zA-Z0-9/._:-]/g, "")}"`,
      `MAX_ITER="${Math.min(parseInt(form.maxIterations || "30", 10) || 30, 60)}"`,
      `COST_CEILING="${process.env.MECHA_COST_CEILING || "5"}"`,
      `OPENROUTER_API_KEY="${process.env.OPENROUTER_API_KEY}"`,
    ].join(" ");
    const start = await sandbox.process.executeCommand(
      `${env} nohup node "${runDir}/harness.js" > "${runDir}/harness.log" 2>&1 & echo MECHA_STARTED`
    );
    if (!String(start.result).includes("MECHA_STARTED")) {
      throw new Error(`start failed: ${start.result}`);
    }
    return NextResponse.json({ runId: sandbox.id, model });
  } catch (e) {
    try {
      await sandbox.delete();
    } catch {}
    return NextResponse.json({ error: `MECHA start failed: ${String(e).slice(0, 300)}` }, { status: 502 });
  }
}

export const maxDuration = 60;
