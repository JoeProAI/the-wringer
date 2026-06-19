import { NextResponse } from "next/server";

// "Draft my work order" — a free, instant prefill powered by GLM 5.2.
// Takes whatever the user has (a pasted post, a claim, a one-line idea) and
// turns it into an editable Work Order: a scoped goal, mechanically-checkable
// acceptance criteria, non-goals, and a recommended strategy. It is a draft,
// never a lock — the UI drops every field into the normal editable form.

export const DRAFT_MODEL_LABEL = "GLM 5.2";

const STRATEGIES = ["adaptive", "senate", "triumvirate", "mega", "best-of-3", "solo-claude", "solo-codex", "frontier-coder"];

const SYSTEM_PROMPT = `You are GLM 5.2 powering "Draft my work order" for The Wringer — a verification/audit tool that runs several AI agents on a task, checks the work against reality (web sources, code execution), and returns a graded result. You are NOT executing the task; you are converting the user's raw input into a clean, editable Work Order so they get the best possible run with whatever they have.

First classify the user's intent as exactly one of:
- "verify"  — they pasted a claim/post/statement and want it fact-checked or its accuracy graded (e.g. "prove if this is right or wrong", a viral tweet, a marketing claim).
- "build"   — they want code/a feature/an artifact produced.
- "research"— they want information gathered, compared, or summarized.
- "fix"     — they want an existing bug/issue diagnosed and repaired.

Then write the Work Order. RULES:
- Acceptance criteria MUST be mechanically checkable (an automated check or an explicit, unambiguous human check). No vague "works well".
- For "verify": criteria must (1) extract and list every distinct claim, (2) classify each as verifiable fact / speculation / unfalsifiable hyperbole, (3) check each against real cited web sources, (4) state what fraction of claims are independently verifiable. Do NOT assume the claim is true or false.
- For "build"/"fix": include a criterion that the output runs / tests pass when executed.
- Recommend a "strategy" from this exact list: ${STRATEGIES.join(", ")}. Default to "adaptive" unless there is a strong reason otherwise.
- "notes": 1-3 SHORT pointers telling the user how to sharpen anything you had to guess, or flagging ambiguity. These help them edit. Keep each under 18 words.
- Produce 2 to 5 acceptance criteria. Be concrete and specific to THIS input.

Return STRICT JSON only (no markdown, no prose) with exactly these keys:
{"intent": "...", "goal": "one sentence", "acceptanceCriteria": ["...", "..."], "nonGoals": ["..."], "strategy": "...", "notes": ["..."]}`;

function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // Strip ```json ... ``` fences if the model added them.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asStringArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

// Lightweight per-IP rate limit so the free draft endpoint can't be hammered
// to run up OpenRouter spend. Fixed window, in-memory: best-effort only
// (serverless instances don't share state), but it stops the obvious abuse.
const RATE_LIMIT = parseInt(process.env.DRAFT_RATE_LIMIT || "5", 10);
const RATE_WINDOW_MS = 60_000;
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start >= RATE_WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.start >= RATE_WINDOW_MS) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

export async function POST(req) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: `Too many drafts — give GLM 5.2 a minute (limit ${RATE_LIMIT}/min).` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const input = (body?.input || "").toString().trim();
  if (!input) {
    return NextResponse.json({ error: "Paste a post, a claim, or describe what you want." }, { status: 400 });
  }
  if (input.length > 8000) {
    return NextResponse.json({ error: "That's too long to draft — trim it under 8000 characters." }, { status: 400 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });
  }

  const model = process.env.DRAFT_MODEL || "z-ai/glm-5.2";

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "https://the-wringer.vercel.app",
        "X-Title": "The Wringer",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: `Draft request failed: ${e.message}` }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `Draft model error ${res.status}`, detail: detail.slice(0, 300) }, { status: 502 });
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "GLM 5.2 returned an unreadable draft. Try rephrasing." }, { status: 502 });
  }

  const acceptanceCriteria = asStringArray(parsed.acceptanceCriteria).slice(0, 6);
  const strategy = STRATEGIES.includes(parsed.strategy) ? parsed.strategy : "adaptive";

  return NextResponse.json({
    intent: typeof parsed.intent === "string" ? parsed.intent : "verify",
    goal: (parsed.goal || "").toString().trim(),
    acceptanceCriteria: acceptanceCriteria.length ? acceptanceCriteria : [input.slice(0, 200)],
    nonGoals: asStringArray(parsed.nonGoals),
    strategy,
    notes: asStringArray(parsed.notes).slice(0, 4),
    model_label: DRAFT_MODEL_LABEL,
  });
}

export const maxDuration = 60;
