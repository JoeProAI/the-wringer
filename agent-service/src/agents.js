import { OPENAI_TOOLS, executeTool } from "./tools.js";

// ---------------------------------------------------------------------------
// Personas. Each is a distinct agent = persona system prompt + chosen model +
// a tool/loop strategy. These are NOT bare model aliases.
// ---------------------------------------------------------------------------
export const PERSONAS = {
  hermes: {
    name: "Hermes",
    engine: "xai-tools",
    defaultModel: process.env.HERMES_MODEL || "grok-4.3",
    systemPrompt:
      "You are Hermes, a live-internet research agent. You have native web search and X (Twitter) search. " +
      "For any question that touches current events, products, people, claims, or anything that may have changed recently, " +
      "actively search the web and X before answering. Ground every material claim in what you find and cite sources. " +
      "Be concise, specific, and honest about uncertainty. If the live sources do not support a claim, say so plainly.",
  },
  openclaw: {
    name: "OpenClaw",
    engine: "openai-tools",
    defaultModel: process.env.OPENCLAW_MODEL || "openai/gpt-5.3-codex",
    systemPrompt:
      "You are OpenClaw, a rigorous reasoning-and-engineering agent. You think step by step, decompose the task, " +
      "and produce a precise, well-structured, defensible answer. You have a web_search tool; call it when you need to " +
      "verify a fact or fetch current information, otherwise rely on careful reasoning. Be concrete and avoid hedging. " +
      "State assumptions explicitly and never fabricate sources or results.",
  },
};

const MAX_OUTPUT_TOKENS = Number(process.env.AGENT_MAX_TOKENS || 1500);

function pickPersona(persona) {
  const key = String(persona || "").toLowerCase();
  return PERSONAS[key] || null;
}

// ---------------------------------------------------------------------------
// Hermes: xAI Agent Tools API (/v1/responses) with server-side web + X search.
// Returns answer text plus citations.
// ---------------------------------------------------------------------------
async function runHermes(model, prompt, systemPrompt, timeoutMs) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not configured");
  const baseUrl = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/+$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search" }, { type: "x_search" }],
        max_tool_calls: Number(process.env.HERMES_MAX_TOOL_CALLS || 6),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        stream: false,
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI responses error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();

  let answer = (data.output_text || "").trim();
  const citations = [];
  if (!answer && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" && c.text) {
            answer += (answer ? "\n" : "") + c.text;
            for (const ann of c.annotations || []) {
              if (ann.url) citations.push(ann.url);
            }
          }
        }
      }
    }
  }
  // Fallback: pull bracketed URL citations out of the text.
  for (const m of answer.matchAll(/\((https?:\/\/[^)\s]+)\)/g)) citations.push(m[1]);

  const usage = data.usage || {};
  const ticks = usage.cost_in_usd_ticks;
  return {
    answer: answer || "No response generated.",
    citations: [...new Set(citations)],
    usage,
    cost_usd: typeof ticks === "number" ? ticks / 1e9 : undefined,
    tool_calls: usage?.num_server_side_tools_used,
  };
}

// ---------------------------------------------------------------------------
// OpenClaw: OpenAI-compatible chat completions (routed via OpenRouter) with a
// function-calling web_search loop.
// ---------------------------------------------------------------------------
async function runOpenClaw(model, prompt, systemPrompt, timeoutMs) {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  const useOpenRouter = !!orKey;
  const apiKey = useOpenRouter ? orKey : oaKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY not configured");

  const baseUrl = useOpenRouter
    ? "https://openrouter.ai/api/v1"
    : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const deadline = Date.now() + timeoutMs;
  let totalCost = 0;
  let toolRounds = 0;
  const MAX_TOOL_ROUNDS = 3;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const controller = new AbortController();
    const remaining = Math.max(1000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    let res;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(useOpenRouter
            ? { "HTTP-Referer": "https://thewringer.ai", "X-Title": "The Wringer" }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          ...(round < MAX_TOOL_ROUNDS ? { tools: OPENAI_TOOLS } : {}),
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenClaw model error ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = await res.json();
    if (typeof data?.usage?.cost === "number") totalCost += data.usage.cost;
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("OpenClaw: empty choices");

    const toolCalls = msg.tool_calls || [];
    if (toolCalls.length && round < MAX_TOOL_ROUNDS) {
      messages.push(msg);
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await executeTool(tc.function?.name, args);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        toolRounds++;
      }
      continue;
    }

    return {
      answer: (msg.content || "No response generated.").trim(),
      citations: [],
      usage: data.usage || {},
      cost_usd: totalCost || undefined,
      tool_calls: toolRounds,
    };
  }
  return { answer: "No response generated.", citations: [], tool_calls: toolRounds };
}

export async function runAgent({ prompt, persona, model, timeoutMs }) {
  const p = pickPersona(persona);
  if (!p) throw new Error(`Unknown persona: ${persona} (expected hermes|openclaw)`);
  const chosenModel = model || p.defaultModel;
  const started = Date.now();
  const out =
    p.engine === "xai-tools"
      ? await runHermes(chosenModel, prompt, p.systemPrompt, timeoutMs)
      : await runOpenClaw(chosenModel, prompt, p.systemPrompt, timeoutMs);
  return {
    persona: p.name,
    model: chosenModel,
    elapsed_ms: Date.now() - started,
    ...out,
  };
}
