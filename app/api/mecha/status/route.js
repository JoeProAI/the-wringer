import { NextResponse } from "next/server";
import { getDaytona } from "../../../../lib/daytona";

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
  const res = await sandbox.process.executeCommand(
    `tail -n 60 "${runDir}/mecha/state/events.jsonl" 2>/dev/null`
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

  // Download the report file directly — shell command output gets truncated
  // for large reports.
  let report = null;
  try {
    const buf = await sandbox.fs.downloadFile(`${runDir}/report.json`);
    report = JSON.parse(buf.toString("utf-8"));
  } catch {}

  if (report) {
    try {
      await sandbox.stop();
    } catch {}
  }

  return NextResponse.json({ done: !!report, progress, report });
}

export const maxDuration = 60;
