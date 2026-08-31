// Email delivery for MECHA run deliverables.
// Uses Resend API to send the GAMMA report and presentation links to the
// customer after a paid run completes. Fails closed: if RESEND_API_KEY is
// missing, the email silently skips without affecting the run result.

import { Resend } from "resend";
import Stripe from "stripe";

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "reports@thewringer.ai";
const MAX_REPORT_LENGTH = 50000;

// Escapes HTML special characters to prevent XSS from model output.
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Truncates text to a maximum length, adding ellipsis if needed.
function truncate(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 100) + "\n\n[... truncated for email. Full report was shown in session.]";
}

// Formats model cost in USD.
function fmtCost(cost) {
  const n = Number(cost || 0);
  return n < 0.01 ? "<$0.01" : `$${n.toFixed(4)}`;
}

// Builds the plain text email body.
function buildPlainText(report, sessionEmail) {
  const exitName = report.exit_name || "UNKNOWN";
  const exitCode = report.exit_code ?? "?";
  const strategy = report.strategy || "unknown";
  const modelCost = fmtCost(report.cost_usd);
  const elapsed = Number(report.elapsed_s || 0).toFixed(1);

  let winner = "";
  if (report.winner && report.candidates?.length) {
    const idx = report.winner - 1;
    const cand = report.candidates[idx];
    if (cand) {
      winner = `Winner: Candidate ${report.winner} (${cand.name || "unknown"})`;
      if (report.confidence != null) winner += ` with confidence ${report.confidence}`;
    }
  }

  const lines = [
    `MECHA RUN COMPLETE`,
    ``,
    `Exit: ${exitCode} ${exitName}`,
    `Strategy: ${strategy}`,
    `Duration: ${elapsed}s`,
    `Model cost: ${modelCost}`,
    winner ? winner : null,
    ``,
    `---`,
    ``,
  ].filter((l) => l !== null);

  if (report.gamma) {
    lines.push(`GAMMA HQ REPORT`);
    lines.push(``);
    lines.push(truncate(report.gamma, MAX_REPORT_LENGTH));
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  if (report.gamma_presentation_url) {
    lines.push(`View HD Presentation: ${report.gamma_presentation_url}`);
  }
  if (report.gamma_export_url) {
    lines.push(`Download PDF: ${report.gamma_export_url}`);
  }
  if (report.gamma_presentation_url || report.gamma_export_url) {
    lines.push(``);
  }

  if (!report.gamma_presentation_url && report.gamma) {
    lines.push(`Note: HD presentation was not generated for this run (timeout or configuration).`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`This email is your copy of the MECHA run deliverable.`);
  lines.push(`The live results page is session-only and not stored.`);
  lines.push(``);
  lines.push(`Run ID: ${report.run_id || "unknown"}`);
  lines.push(`Sent to: ${sessionEmail}`);
  lines.push(``);
  lines.push(`The Wringer - thewringer.ai`);

  return lines.join("\n");
}

// Builds the HTML email body.
function buildHtml(report, sessionEmail) {
  const exitName = escapeHtml(report.exit_name || "UNKNOWN");
  const exitCode = report.exit_code ?? "?";
  const strategy = escapeHtml(report.strategy || "unknown");
  const modelCost = fmtCost(report.cost_usd);
  const elapsed = Number(report.elapsed_s || 0).toFixed(1);

  let winnerHtml = "";
  if (report.winner && report.candidates?.length) {
    const idx = report.winner - 1;
    const cand = report.candidates[idx];
    if (cand) {
      winnerHtml = `<p><strong>Winner:</strong> Candidate ${escapeHtml(String(report.winner))} (${escapeHtml(cand.name || "unknown")})`;
      if (report.confidence != null) winnerHtml += ` with confidence ${escapeHtml(String(report.confidence))}`;
      winnerHtml += `</p>`;
    }
  }

  const gammaHtml = report.gamma
    ? `<h2 style="color:#c8351f;font-family:'Big Shoulders Display',Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;margin:32px 0 16px;">GAMMA HQ Report</h2>
<pre style="background:#1f1812;border:1px solid #3a332a;padding:18px;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:#d9d0bc;max-height:600px;overflow:auto;">${escapeHtml(truncate(report.gamma, MAX_REPORT_LENGTH))}</pre>`
    : "";

  const linksHtml = [];
  if (report.gamma_presentation_url) {
    linksHtml.push(
      `<a href="${escapeHtml(report.gamma_presentation_url)}" style="display:inline-block;background:#c8351f;color:#ede6d6;padding:14px 24px;font-family:'Big Shoulders Display',Arial,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:2px;font-size:16px;text-decoration:none;margin-right:12px;margin-bottom:12px;">View HD Presentation</a>`
    );
  }
  if (report.gamma_export_url) {
    linksHtml.push(
      `<a href="${escapeHtml(report.gamma_export_url)}" style="display:inline-block;background:#c8351f;color:#ede6d6;padding:14px 24px;font-family:'Big Shoulders Display',Arial,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:2px;font-size:16px;text-decoration:none;margin-bottom:12px;">Download PDF</a>`
    );
  }

  const presentationNote =
    !report.gamma_presentation_url && report.gamma
      ? `<p style="color:#9a917c;font-size:13px;margin:16px 0;">Note: HD presentation was not generated for this run (timeout or configuration).</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MECHA Run Complete - The Wringer</title>
</head>
<body style="margin:0;padding:0;background:#16120d;font-family:'Libre Franklin',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#16120d;padding:32px 16px;">
<tr>
<td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#16120d;">
<tr>
<td style="border-top:6px solid #c8351f;padding:32px 24px;">
<h1 style="font-family:'Big Shoulders Display',Arial,sans-serif;font-weight:900;font-size:36px;color:#ede6d6;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">
THE <span style="color:#c8351f;">WRINGER</span>
</h1>
<p style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#c8351f;letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">
MECHA RUN COMPLETE
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#1f1812;border:1px solid #3a332a;margin-bottom:24px;">
<tr>
<td style="padding:20px;">
<p style="margin:0 0 8px;color:#ede6d6;font-size:15px;">
<strong>Exit:</strong> ${exitCode} ${exitName}
</p>
<p style="margin:0 0 8px;color:#d9d0bc;font-size:14px;">
<strong>Strategy:</strong> ${strategy} &nbsp;|&nbsp; <strong>Duration:</strong> ${elapsed}s &nbsp;|&nbsp; <strong>Model cost:</strong> ${modelCost}
</p>
${winnerHtml}
</td>
</tr>
</table>

${gammaHtml}

${linksHtml.length ? `<div style="margin:24px 0;">${linksHtml.join("")}</div>` : ""}

${presentationNote}

<hr style="border:none;border-top:1px solid #3a332a;margin:32px 0;">

<p style="color:#9a917c;font-size:13px;line-height:1.6;margin:0 0 8px;">
This email is your copy of the MECHA run deliverable. The live results page is session-only and not stored.
</p>
<p style="color:#9a917c;font-size:12px;font-family:'IBM Plex Mono',monospace;margin:0;">
Run ID: ${escapeHtml(report.run_id || "unknown")}<br>
Sent to: ${escapeHtml(sessionEmail)}
</p>

<hr style="border:none;border-top:1px solid #3a332a;margin:32px 0;">

<p style="color:#9a917c;font-size:12px;margin:0;">
<a href="https://www.thewringer.ai" style="color:#c8351f;text-decoration:none;">The Wringer</a> - One paid run, one honest verdict.
</p>

</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// Retrieves the customer email from the Stripe checkout session.
// Returns null if the session cannot be retrieved or has no email.
async function getSessionEmail(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY || !sessionId) return null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.customer_details?.email || session.customer_email || null;
  } catch {
    return null;
  }
}

// Sends the MECHA deliverable email to the customer.
// Returns { sent: true } on success, { sent: false, reason: string } on skip/failure.
// Never throws - always returns gracefully so the run result is not blocked.
export async function sendMechaDeliverable({ report, sessionId, runId }) {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  if (!report || typeof report !== "object") {
    return { sent: false, reason: "No report provided" };
  }

  if (!sessionId) {
    return { sent: false, reason: "No session ID (unpaid or free mode)" };
  }

  const email = await getSessionEmail(sessionId);
  if (!email) {
    return { sent: false, reason: "Could not retrieve customer email from session" };
  }

  const exitName = report.exit_name || "UNKNOWN";
  const subject = `MECHA Run Complete: ${exitName} - The Wringer`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `The Wringer <${FROM_ADDRESS}>`,
      to: [email],
      subject,
      html: buildHtml(report, email),
      text: buildPlainText(report, email),
      headers: {
        "X-Wringer-Run-ID": runId || report.run_id || "unknown",
      },
    });
    return { sent: true, email };
  } catch (err) {
    return { sent: false, reason: `Resend error: ${String(err).slice(0, 200)}` };
  }
}
