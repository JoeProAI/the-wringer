import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You help people fill out a Work Order for The Wringer — a product that audits or multi-agent-executes agent tasks.

Your job: turn messy human intent into a tight, honest work order.

Rules:
- Goal: ONE sentence. What must be true when the agent stops. Concrete outcome, not vibes.
- Acceptance criteria: 2-5 items. Each must be mechanically checkable (command, HTTP check, file exists, test passes, visible UI state). Prefer AUTO over HUMAN.
- Non-goals: what is explicitly out of scope (refactors, deploys, extra features).
- Max iterations: integer 5-100, default 30 unless the task is tiny (15) or large (45-60).
- Preauthorized: only irreversible/outward actions the user clearly allowed. Otherwise empty string.
- Never invent credentials, private URLs, or production deploy permission.
- Plain language. No hype. No hashtags. No em dashes.

Return ONLY valid JSON with this shape:
{
  "reply": "short plain-English note to the user about what you filled and what they should verify",
  "goal": "string",
  "acs": [{"text":"string","kind":"AUTO|HUMAN","check":"optional how to check","expect":"optional expected signal"}],
  "nonGoals": "string",
  "maxIterations": 30,
  "preauthorized": "string",
  "tips": ["how to read audit grades", "what SUCCESS vs PARTIAL means"]
}`;

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const form = body.form || {};
    if (!message) {
      return NextResponse.json({ error: "Say what you want the agent to do." }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "Keep it under 4000 characters." }, { status: 400 });
    }

    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Grok assist is not configured yet (missing XAI_API_KEY)." },
        { status: 503 }
      );
    }

    const model = process.env.XAI_MODEL || process.env.WRINGER_GROK_MODEL || "grok-4.5";
    const userPayload = {
      message,
      current_form: {
        goal: form.goal || "",
        acs: Array.isArray(form.acs) ? form.acs.slice(0, 8) : [],
        nonGoals: form.nonGoals || "",
        maxIterations: form.maxIterations || 30,
        preauthorized: form.preauthorized || "",
      },
    };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Draft or improve this Wringer work order.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.error || `Grok request failed (${res.status})`;
      return NextResponse.json({ error: String(msg) }, { status: 502 });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    if (!parsed || !parsed.goal) {
      return NextResponse.json(
        { error: "Grok returned an unusable draft. Try again with a clearer ask." },
        { status: 502 }
      );
    }

    const acs = (Array.isArray(parsed.acs) ? parsed.acs : [])
      .filter((a) => a && String(a.text || "").trim())
      .slice(0, 8)
      .map((a) => ({
        text: String(a.text || "").trim(),
        kind: a.kind === "HUMAN" ? "HUMAN" : "AUTO",
        check: String(a.check || "").trim(),
        expect: String(a.expect || "").trim(),
      }));

    return NextResponse.json({
      model,
      reply: String(parsed.reply || "Draft ready. Check the fields and tighten anything fuzzy.").trim(),
      form: {
        goal: String(parsed.goal || "").trim(),
        acs: acs.length ? acs : [{ text: "", kind: "AUTO", check: "", expect: "" }],
        nonGoals: String(parsed.nonGoals || "").trim(),
        maxIterations: Math.max(5, Math.min(100, Number(parsed.maxIterations) || 30)),
        preauthorized: String(parsed.preauthorized || "").trim(),
      },
      tips: Array.isArray(parsed.tips) ? parsed.tips.map(String).slice(0, 6) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Assist failed" }, { status: 500 });
  }
}
