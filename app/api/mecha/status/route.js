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
  // exactly once. Uses both a sandbox marker file and a label for idempotency:
  // - Marker file (.email-sent) handles the case where setLabels fails
  // - Label allows fast check without reading the marker file
  let emailSent = labels["email-sent"] === "true";
  if (report && sessionId && !emailSent) {
    // Check for marker file in case label update failed on a previous attempt
    try {
      const markerCheck = await sandbox.process.executeCommand(
        `test -f "${runDir}/.email-sent" && echo EXISTS`
      );
      if (String(markerCheck.result || "").includes("EXISTS")) {
        emailSent = true;
      }
    } catch {
      // Ignore marker check errors, proceed with send attempt
    }

    if (!emailSent) {
      const emailResult = await sendMechaDeliverable({
        report,
        sessionId,
        runId,
      });
      emailSent = emailResult.sent;
      if (emailResult.sent) {
        // Write marker file first (more reliable than label update)
        try {
          await sandbox.process.executeCommand(
            `echo "sent" > "${runDir}/.email-sent"`
          );
        } catch {
          // Marker write failed, but email was sent - try label as backup
        }
        // Also update label for fast path on subsequent polls
        try {
          await sandbox.setLabels({ ...labels, "email-sent": "true" });
        } catch {
          // Label update failed but marker file should prevent re-send
        }
      }
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
