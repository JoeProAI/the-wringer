import express from "express";
import { runAgent, PERSONAS } from "./agents.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8080);
const AUTH_TOKEN = process.env.WRINGER_AGENT_TOKEN || "";
const DEFAULT_TIMEOUT_S = Number(process.env.AGENT_TIMEOUT_S || 180);

function authed(req) {
  if (!AUTH_TOKEN) return true; // no token configured => open (local dev only)
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === AUTH_TOKEN;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "wringer-agents",
    agents: Object.keys(PERSONAS),
    models: Object.fromEntries(
      Object.entries(PERSONAS).map(([k, v]) => [k, v.defaultModel])
    ),
  });
});

app.post("/run", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: "unauthorized" });
  const { prompt, persona, model } = req.body || {};
  if (!prompt || !persona) {
    return res.status(400).json({ error: "prompt and persona are required" });
  }
  const timeoutMs = Math.max(5, Number(req.body?.timeout_s || DEFAULT_TIMEOUT_S)) * 1000;
  try {
    const result = await runAgent({ prompt, persona, model, timeoutMs });
    res.json(result);
  } catch (err) {
    const msg = err?.name === "AbortError" ? "agent timed out" : err?.message || String(err);
    console.error(`[run] persona=${persona} error: ${msg}`);
    res.status(502).json({ error: msg, persona });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[wringer-agents] listening on :${PORT} (auth ${AUTH_TOKEN ? "on" : "OFF"})`);
});
