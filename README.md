# The Wringer

Fill out your agent mission contract and put it through **LOOP PROTOCOL v5.0**:

- **Audit ($1)** — brutal contract audit + 5-iteration dry-run with a graded verdict (single OpenRouter call).
- **MECHA RUN ($10)** — real execution: a fresh Daytona sandbox runs a tool-calling agent (shell + file access) governed by a harness that structurally enforces the protocol's [HARD] rules — iteration caps, banned-repeat hashing, stall counters, and a hard model-cost ceiling. Returns live telemetry and the S11 final report with an S10 exit code.

## Stack
- Next.js 14 (App Router), Vercel
- Stripe Checkout (pay-per-run, no DB — PaymentIntent metadata marks a run used; `wringer_tier` separates audit vs mecha)
- OpenRouter (server-side key)
- Daytona SDK (per-run sandboxes, auto-stop 30 min, auto-delete 4 h, labeled `platform: the-wringer`)

## Env vars
- `OPENROUTER_API_KEY` — required
- `OPENROUTER_MODEL` — audit model, default `anthropic/claude-sonnet-4.5`
- `STRIPE_SECRET_KEY` — required unless FREE_MODE
- `PRICE_CENTS` — audit price, default `100`
- `MECHA_PRICE_CENTS` — mecha price, default `1000`
- `MECHA_MODEL` — default `x-ai/grok-4.3` (UI offers grok-4.3 / claude-sonnet-4.5 / gpt-5.3-codex)
- `MECHA_COST_CEILING` — max model spend per run in USD, default `5`
- `DAYTONA_API_KEY` — required for MECHA RUN
- `DAYTONA_TARGET` — default `us`
- `FREE_MODE` — `true` to skip payments (testing)
- `SITE_URL` — canonical URL

