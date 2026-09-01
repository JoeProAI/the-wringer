import WebSocket from "ws";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = await (await fetch("http://127.0.0.1:9224/json")).json();
const page = pages.find((entry) => entry.type === "page" && entry.url.startsWith("https://www.thewringer.ai"));
if (!page) throw new Error("The Wringer Chrome tab was not found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
let callId = 0;
const pending = new Map();
socket.on("message", (data) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
await new Promise((resolve) => socket.once("open", resolve));

const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++callId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
};

const show = async (kicker, title, body) =>
  evaluate(`(() => {
    let card = document.getElementById("wringer-demo-overlay");
    if (!card) {
      card = document.createElement("div");
      card.id = "wringer-demo-overlay";
      card.style.cssText = "position:fixed;z-index:2147483647;right:32px;top:88px;width:460px;padding:20px 22px;background:#16120df2;border:1px solid #5a5144;border-left:6px solid #c8351f;box-shadow:10px 10px 0 #0008;color:#ede6d6;font-family:Libre Franklin,sans-serif;pointer-events:none";
      document.documentElement.appendChild(card);
    }
    card.innerHTML = '<div style="font:600 11px IBM Plex Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:#e25a3f;margin-bottom:8px">' + ${JSON.stringify(kicker)} + '</div><div style="font:900 30px Big Shoulders Display,sans-serif;letter-spacing:.04em;text-transform:uppercase;line-height:1;margin-bottom:10px">' + ${JSON.stringify(title)} + '</div><div style="font-size:15px;line-height:1.5;color:#d9d0bc">' + ${JSON.stringify(body)} + '</div>';
  })()`);

const execute = (name, input) =>
  evaluate(`(async () => {
    const tools = await document.modelContext.getTools();
    const tool = tools.find((entry) => entry.name === ${JSON.stringify(name)});
    return document.modelContext.executeTool(tool, ${JSON.stringify(JSON.stringify(input))});
  })()`);

await evaluate(`(() => { window.scrollTo(0, 0); document.documentElement.style.scrollBehavior = "smooth"; })()`);
await show(
  "Chrome 150 · Native WebMCP",
  "6 tools discovered",
  "create_case_file · review_case_file · run_quick_attack<br>apply_audit_repairs · start_full_case · get_full_case_status"
);
await wait(9000);

await show(
  "One natural-language request",
  "Make this verifiable",
  "Prevent duplicate password-reset emails while the first reset link remains valid. Review the gaps, then repair them."
);
await wait(5000);
await evaluate(`document.querySelector(".agent-docket").scrollIntoView({ block: "center" })`);
await wait(1500);

await show("WebMCP tool call 01", "create_case_file", "Structured intent writes directly into the same work order a human edits.");
await wait(1500);
await execute("create_case_file", {
  goal: "Prevent duplicate password-reset emails while the first reset link remains valid.",
  acceptance_criteria: [
    {
      text: "A second reset request is blocked while the first link is valid.",
      kind: "AUTO",
    },
  ],
  non_goals: "Do not redesign the flow or contact real customers.",
  max_iterations: 20,
});
await wait(5500);

await show("WebMCP tool call 02", "review_case_file", "The free readiness review looks for checks an agent cannot fake.");
await wait(1500);
await execute("review_case_file", {});
await wait(500);
await evaluate(`document.querySelector(".agent-docket").scrollIntoView({ block: "center" })`);
await wait(6500);

await show("Review result", "2 verification gaps", "No machine check. No falsifiable expected signal. The agent now repairs both.");
await wait(4000);
await show("WebMCP tool call 03", "create_case_file · repaired", "The weak criterion is replaced in the same shared product state.");
await wait(1500);
await execute("create_case_file", {
  goal: "Prevent duplicate password-reset emails while the first reset link remains valid.",
  acceptance_criteria: [
    {
      text: "A second reset request is blocked while the first link is valid.",
      kind: "AUTO",
      check: "Issue two reset requests for one account within 60 seconds.",
      expect: "The second request sends no email and returns the documented duplicate response.",
    },
  ],
  non_goals: "Do not redesign the flow or contact real customers.",
  max_iterations: 20,
});
await wait(6500);

await show("WebMCP tool call 04", "run_quick_attack", "The agent can stage paid work, but it cannot start checkout or spend.");
await wait(1500);
await execute("run_quick_attack", {});
await wait(500);
await evaluate(`document.querySelector(".agent-docket").scrollIntoView({ block: "center" })`);
await wait(7500);

await show("Human approval boundary", "Nothing was charged", "confirmation_required: true<br>checkout_started: false<br>charged: false");
await wait(10500);
await show("The agent-native web", "Intent → evidence → repair → approval", "Typed capabilities replace screen scraping. Humans and agents operate one product state, with the human in control.");
await wait(10000);
await evaluate(`document.getElementById("wringer-demo-overlay")?.remove()`);
await wait(3000);
socket.close();
