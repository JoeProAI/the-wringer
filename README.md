# The Wringer

Fill out your agent mission contract and put it through **LOOP PROTOCOL v5.0**:

- **Audit ($1)** — brutal contract audit + 5-iteration dry-run with a graded verdict (single OpenRouter call).
- **MECHA RUN ($10)** — dispatches the compiled contract to the real [MECHA orchestrator](https://github.com/JoeProAI/mecha) in a fresh Daytona sandbox: a swarm of worker agents (Claude, Codex, Grok lineages via OpenRouter fallback) fans out under the chosen strategy (senate / triumvirate / best-of-3 / solo-claude / solo-codex / frontier-coder) and a reviewer synthesizes the final answer. Live telemetry streams from MECHA's events.jsonl; returns the final report + exit code. The MECHA snapshot is vendored at `vendor/mecha.tar.gz.b64` (see `vendor/README.md` to regenerate).

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
- `MECHA_OPENROUTER_CLAUDE_MODEL` / `MECHA_OPENROUTER_CODEX_MODEL` — optional model overrides for MECHA's OpenRouter fallback
- `DAYTONA_API_KEY` — required for MECHA RUN
- `DAYTONA_TARGET` — default `us`
- `FREE_MODE` — `true` to skip payments (testing)
- `SITE_URL` — canonical URL
- `NEXT_PUBLIC_POSTHOG_KEY` — PostHog project API key (analytics disabled if unset)
- `NEXT_PUBLIC_POSTHOG_HOST` — default `https://us.i.posthog.com`
- `XAI_API_KEY` — enables Grok work-order coach (`/api/assist`)
- `XAI_MODEL` / `WRINGER_GROK_MODEL` — optional, default `grok-4.5`
- `GAMMA_APP_API_KEY` — Gamma.app API key. Injected into the Daytona sandbox. Without it, HD presentation silently skips.
- `GAMMA_MODEL` — OpenRouter model for the HQ text GAMMA report. Default `anthropic/claude-opus-4.1`. Note: presentation images use Gamma `imageOptions.model=gpt-image-2`, which is not configurable via env var.


## Grok coach rate limit

`/api/assist` is capped per client IP (in-memory sliding window):

- `ASSIST_RATE_LIMIT` (default **12**)
- `ASSIST_RATE_WINDOW_MS` (default **3600000** = 1 hour)

Over limit returns HTTP 429 with `Retry-After`.
