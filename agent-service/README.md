# wringer-agents

A small, dedicated agent-worker service for **The Wringer**. It exposes two real
agents — **Hermes** (live web/X research) and **OpenClaw** (reasoning/engineering
doer with tool calling) — behind one authed HTTP endpoint so a MECHA run can add
them as genuine, distinct candidates instead of shelling out to local CLIs that
don't exist in the run sandbox.

These are **not bare model aliases**: each is a persona + a deliberately chosen,
distinct model + a tool/loop strategy.

| Persona  | Engine                         | Default model         | Capability edge                    |
| -------- | ------------------------------ | --------------------- | ---------------------------------- |
| Hermes   | xAI Agent Tools (`/v1/responses`) | `grok-4.3`         | Native live **web + X** search w/ citations |
| OpenClaw | OpenAI-compatible chat (via OpenRouter) | `openai/gpt-5.3-codex` | Rigorous reasoning + `web_search` function calling |

## API

### `GET /health`
```json
{ "ok": true, "agents": ["hermes","openclaw"], "models": { "hermes": "grok-4.3", "openclaw": "openai/gpt-5.3-codex" } }
```

### `POST /run`  (Bearer auth)
Request:
```json
{ "prompt": "…", "persona": "hermes" | "openclaw", "model": "(optional override)", "timeout_s": 180 }
```
Response:
```json
{ "persona": "Hermes", "model": "grok-4.3", "elapsed_ms": 15219, "answer": "…", "citations": ["https://…"], "tool_calls": 6, "cost_usd": 0.45, "usage": { … } }
```
On failure returns HTTP 502 `{ "error": "…", "persona": "…" }` so a MECHA fan-out
degrades cleanly instead of crashing the run.

## Run locally
```bash
npm install
cp .env.example .env   # fill in keys
WRINGER_AGENT_TOKEN=… XAI_API_KEY=… OPENROUTER_API_KEY=… npm start
```

## Deploy (Fly, scale-to-zero)
```bash
fly launch --no-deploy        # uses fly.toml
fly secrets set WRINGER_AGENT_TOKEN=… XAI_API_KEY=… OPENROUTER_API_KEY=…
fly deploy
```
`min_machines_running = 0` + `auto_stop_machines` means idle cost is ~free; the
machine wakes on the first request. The Wringer points `WRINGER_AGENT_ENDPOINT`
at this app's URL and sends `WRINGER_AGENT_TOKEN` as the bearer token.

## Notes
- OpenClaw routes through **OpenRouter** by default (one key serves gpt-5.3-codex,
  and the direct OpenAI key may lack completion quota). If only `OPENAI_API_KEY`
  is set, it is used directly instead.
- Hermes cost scales with tool calls; `HERMES_MAX_TOOL_CALLS` (default 6) bounds it.
