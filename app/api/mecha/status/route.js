import { NextResponse } from "next/server";
import { getDaytona } from "../../../../lib/daytona";
import { sendMechaDeliverable } from "../../../../lib/email";

export async function POST(req) {
  const body = await req.json();
  const { runId, sessionId } = body || {};
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const daytona = getDaytona();
  let sandbox;
  try {
    sandbox = await daytona.get(runId);
  } catch {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const labels = sandbox.labels || {};
  if (labels.platform !== "the-wringer" || labels.purpose !== "mecha-run") {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const expected = sessionId ? String(sessionId).slice(0, 60) : "free-mode";
  if (labels["stripe-session"] !== expected) {
    return NextResponse.json({ error: "Not your run" }, { status: 403 });
  }

  if (sandbox.state !== "started") {
    try {
      await sandbox.start();
    } catch {
      return NextResponse.json({ error: "Sandbox unavailable" }, { status: 502 });
    }
  }

  const rootDir = (await sandbox.getUserRootDir()) || "/home/daytona";
  const runDir = `${rootDir.replace(/\/$/, "")}/wringer`;
  // Mega runs emit far more events (one per agent + bracket layers), so keep a
  // generous tail.
  const res = await sandbox.process.executeCommand(
    `tail -n 200 "${runDir}/mecha/state/events.jsonl" 2>/dev/null`
  );
  const progress = String(res.result || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Download the report file directly - shell command output gets truncated
  // for large reports.
  let report = null;
  try {
    const buf = await sandbox.fs.downloadFile(`${runDir}/report.json`);
    report = JSON.parse(buf.toString("utf-8"));
  } catch {}

  // When the run completes and we have a report, send the deliverable email
  // exactly once. The email-sent label tracks idempotency so status polling
  // does not re-send. Email failures are logged but do not block the result.
  let emailSent = false;
  if (report && sessionId && labels["email-sent"] !== "true") {
    const emailResult = await sendMechaDeliverable({
      report,
      sessionId,
      runId,
    });
    emailSent = emailResult.sent;
    if (emailResult.sent) {
      try {
        await sandbox.setLabels({ ...labels, "email-sent": "true" });
      } catch {
        // Label update failed - email may be sent again on next poll, but
        // that's better than blocking the run.
      }
    }
    // Log email result for debugging (no sensitive data)
    if (!emailResult.sent && emailResult.reason) {
      console.log(`[mecha-email] run=${runId} skipped: ${emailResult.reason}`);
    }
  }

  if (report) {
    try {
      await sandbox.stop();
    } catch {}
  }

  return NextResponse.json({
    done: !!report,
    progress,
    report,
    emailSent: emailSent || labels["email-sent"] === "true",
  });
}

export const maxDuration = 60;
