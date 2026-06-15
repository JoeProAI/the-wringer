import express from "express";
import crypto from "node:crypto";
import { runAgent, PERSONAS } from "./agents.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8080);
const AUTH_TOKEN = process.env.WRINGER_AGENT_TOKEN || "";
const DEFAULT_TIMEOUT_S = Number(process.env.AGENT_TIMEOUT_S || 180);

// Constant-time string compare. Hashes both sides to a fixed length first so
// timingSafeEqual never sees mismatched lengths and no length info leaks.
function safeEqual(a, b) {
  const ah = crypto.createHash("sha256").update(String(a)).digest();
  const bh = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function authed(req) {
  if (!AUTH_TOKEN) return true; // no token configured => open (local dev only)
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return !!m && safeEqual(m[1], AUTH_TOKEN);
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
  // Guard against non-numeric timeout_s ("abc", true, {}): Number(...) would be
  // NaN, Math.max(5, NaN) is NaN, and setTimeout(fn, NaN) fires immediately.
  const rawTimeout = Number(req.body?.timeout_s ?? DEFAULT_TIMEOUT_S);
  const timeoutMs =
    (Number.isFinite(rawTimeout) ? Math.max(5, rawTimeout) : DEFAULT_TIMEOUT_S) * 1000;
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
