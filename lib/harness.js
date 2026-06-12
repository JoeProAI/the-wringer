// Harness script that runs INSIDE the Daytona sandbox. Plain Node 18+, no deps.
// Enforces the [HARD] rules of Loop Protocol v5.0 structurally: iteration caps,
// banned-repeat hashing, stall counters, and a hard cost ceiling.
export const HARNESS_SOURCE = `
const fs = require("fs");
const { execSync } = require("child_process");
const crypto = require("crypto");

const WORK = process.env.WRINGER_DIR || "/tmp/wringer";
const WORKSPACE = process.env.WORKSPACE_DIR || WORK + "/work";
const contract = JSON.parse(fs.readFileSync(WORK + "/contract.json", "utf8"));
const MODEL = process.env.MODEL || "x-ai/grok-4.3";
const MAX_ITER = Math.min(parseInt(process.env.MAX_ITER || "30", 10), 60);
const COST_CEILING = parseFloat(process.env.COST_CEILING || "5");
const KEY = process.env.OPENROUTER_API_KEY;

let totalCost = 0;
let iter = 0;
let noProgress = 0;
const actionHashes = {};
const progressPath = WORK + "/progress.jsonl";
const reportPath = WORK + "/report.json";

function log(obj) {
  fs.appendFileSync(progressPath, JSON.stringify({ t: Date.now(), iter, ...obj }) + "\\n");
}
function finish(exit_code, exit_name, report) {
  fs.writeFileSync(reportPath, JSON.stringify({
    exit_code, exit_name, report, cost_usd: +totalCost.toFixed(4), iterations: iter, model: MODEL,
  }, null, 2));
  log({ type: "finish", exit_code, exit_name });
  process.exit(0);
}

const tools = [
  { type: "function", function: { name: "run_shell", description: "Run a shell command inside the sandbox workspace. 120s timeout, output truncated to 8000 chars.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
  { type: "function", function: { name: "write_file", description: "Write a file inside the workspace (relative path).", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "finish", description: "Terminate the run with an exit code per S10 and the final report per S11.", parameters: { type: "object", properties: { exit_code: { type: "integer" }, exit_name: { type: "string" }, report: { type: "string" } }, required: ["exit_code", "exit_name", "report"] } } },
];

function runTool(name, args) {
  if (name === "run_shell") {
    const hash = crypto.createHash("sha1").update(name + JSON.stringify(args)).digest("hex");
    actionHashes[hash] = (actionHashes[hash] || 0) + 1;
    if (actionHashes[hash] > 2) return "[HARNESS T2 VIOLATION] This exact action already failed/ran twice. It is banned verbatim. Change your approach.";
    try {
      const out = execSync(args.command, { cwd: WORKSPACE, timeout: 120000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return out.slice(0, 8000) || "(empty output, exit 0)";
    } catch (e) {
      return ("EXIT " + (e.status ?? "TIMEOUT") + "\\n" + ((e.stdout || "") + (e.stderr || "")).slice(0, 8000));
    }
  }
  if (name === "write_file") {
    if (String(args.path).includes("..")) return "[HARNESS] Path traversal rejected.";
    const p = WORKSPACE + "/" + String(args.path).replace(/^\\/+/, "");
    fs.mkdirSync(require("path").dirname(p), { recursive: true });
    fs.writeFileSync(p, args.content);
    return "Wrote " + p + " (" + args.content.length + " bytes)";
  }
  return "[HARNESS] Unknown tool.";
}

async function chat(messages) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json", "X-Title": "The Wringer MECHA RUN" },
    body: JSON.stringify({ model: MODEL, messages, tools, max_tokens: 4000, usage: { include: true } }),
  });
  if (!res.ok) throw new Error("OpenRouter " + res.status + ": " + (await res.text()).slice(0, 300));
  const data = await res.json();
  if (data.usage && typeof data.usage.cost === "number") totalCost += data.usage.cost;
  return data.choices[0].message;
}

(async () => {
  fs.mkdirSync(WORKSPACE, { recursive: true });
  log({ type: "start", model: MODEL, max_iter: MAX_ITER, ceiling: COST_CEILING });
  const messages = [
    { role: "system", content: contract.systemPrompt },
    { role: "user", content: "MECHA RUN: execute this contract for real inside the sandbox workspace using your tools. Follow the protocol. Verify before claiming. Call finish() with the S10 exit code and S11 final report when done." },
  ];
  while (iter < MAX_ITER) {
    iter++;
    if (totalCost >= COST_CEILING) return finish(5, "BUDGET", "Cost ceiling $" + COST_CEILING + " reached at iteration " + iter + ". Partial work is in the workspace.");
    let msg;
    try { msg = await chat(messages); } catch (e) {
      log({ type: "error", error: String(e).slice(0, 300) });
      await new Promise((r) => setTimeout(r, 3000 * Math.min(iter, 3)));
      try { msg = await chat(messages); } catch (e2) { return finish(4, "STALLED", "Model API failed repeatedly: " + String(e2).slice(0, 300)); }
    }
    messages.push(msg);
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      noProgress++;
      log({ type: "text", text: (msg.content || "").slice(0, 400) });
      if (noProgress >= 3) return finish(4, "STALLED", "Model produced no actions for 3 consecutive iterations. Last output: " + (msg.content || "").slice(0, 1000));
      messages.push({ role: "user", content: "[HARNESS] No tool call emitted. Act via tools or call finish()." });
      continue;
    }
    noProgress = 0;
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch {}
      if (call.function.name === "finish") return finish(args.exit_code ?? 1, args.exit_name || "PARTIAL", args.report || "");
      log({ type: "action", tool: call.function.name, summary: (args.command || args.path || "").slice(0, 200), cost: +totalCost.toFixed(4) });
      const result = runTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
    // Keep context bounded: drop oldest tool exchanges past ~60 messages.
    if (messages.length > 60) messages.splice(2, messages.length - 50);
  }
  finish(5, "BUDGET", "Hard iteration cap " + MAX_ITER + " reached. Partial work is in the workspace.");
})().catch((e) => finish(4, "STALLED", "Harness crash: " + String(e).slice(0, 500)));
`;
