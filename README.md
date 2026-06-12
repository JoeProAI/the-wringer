# Mecha Auth Run

Fill out your agent mission contract, pay $1, and the Mecha runs it through **LOOP PROTOCOL v5.0** via OpenRouter: a brutal contract audit + 5-iteration dry-run with a graded verdict.

## Stack
- Next.js 14 (App Router), Vercel
- Stripe Checkout (pay-per-run, no DB — PaymentIntent metadata marks a run used)
- OpenRouter (server-side key)

## Env vars
- `OPENROUTER_API_KEY` — required
- `OPENROUTER_MODEL` — default `anthropic/claude-sonnet-4.5`
- `STRIPE_SECRET_KEY` — required unless FREE_MODE
- `PRICE_CENTS` — default `100`
- `FREE_MODE` — `true` to skip payments (testing)
- `SITE_URL` — canonical URL

