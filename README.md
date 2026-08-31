# The Wringer

The Wringer turns vague agent work into a checkable contract, then pressure-tests or executes it:

- **Grok Coach:** drafts a goal, acceptance criteria, and boundaries.
- **Quick Attack ($1):** audits the contract, runs a simulated verification loop, grades it, and returns repairs.
- **Full Case ($10+):** runs the contract through the versioned MECHA orchestrator in an isolated Daytona sandbox and returns progress, evidence, an honest exit code, a cost receipt, and optional Gamma deliverables.
- **Native WebMCP:** lets browser agents create, review, repair, and operate the same visible case and run workflows through six structured tools.

WebMCP is part of The Wringer, not a separate demo. Humans and agents use the same React state, route adapters, application services, payment boundary, and MECHA runtime.

## WebMCP tools

- `create_case_file`
- `review_case_file`
- `run_quick_attack`
- `apply_audit_repairs`
- `start_full_case`
- `get_full_case_status`

Paid tools stage the exact operation in the human interface. They never create checkout or spend without the user's visible confirmation. See [docs/webmcp.md](docs/webmcp.md), [docs/hackathon-changes.md](docs/hackathon-changes.md), [docs/demo.md](docs/demo.md), and [docs/scorecard.md](docs/scorecard.md).

## Stack

- Next.js 14 App Router and React 18 on Vercel
- Native `document.modelContext` WebMCP API
- Stripe Checkout for pay-per-run entitlement
- Upstash Redis REST for atomic redemption and bounded replay recovery
- OpenRouter for Quick Attack and MECHA model access
- xAI for the Grok case-file coach
- Daytona for isolated per-run MECHA sandboxes
- Gamma for optional reports and presentations
- Resend for optional deliverable email
- PostHog for privacy-safe product events

There is no account database. Drafts stay in browser storage. Stripe is the payment oracle. Redis stores hashed payment-claim keys for replay protection, a Quick Attack result for up to 24 hours, and a long-lived non-content redemption tombstone. Daytona sandboxes auto-stop after 30 minutes and auto-delete after four hours.

## Local setup

Requirements: Node.js 24 and npm.

```text
npm ci
copy .env.example .env.local
npm run dev
```

The human interface works in normal browsers. To discover tools, use ChatGPT's in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.

## Environment

Copy `.env.example` and set only the providers needed for the flow being tested.

| Variable | Purpose |
|---|---|
| `SITE_URL` | Canonical origin. Production requires HTTPS and rejects paths, credentials, query, and fragments. |
| `STRIPE_SECRET_KEY` | Stripe server key. Never reaches the browser or sandbox. |
| `WRINGER_COOKIE_SECRET` | At least 32 characters. Signs the short-lived HttpOnly payment cookie. |
| `UPSTASH_REDIS_REST_URL` | HTTPS Upstash REST endpoint for atomic payment claims. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token. Server-only. Vercel Marketplace's `KV_REST_API_URL` and `KV_REST_API_TOKEN` aliases are also accepted. |
| `OPENROUTER_API_KEY` | Quick Attack model access. It remains server-only. |
| `OPENROUTER_MANAGEMENT_KEY` | Creates five-hour, per-run MECHA keys capped to the purchased run budget. It never reaches the sandbox. |
| `OPENROUTER_MODEL` | Quick Attack model. Default `anthropic/claude-sonnet-4.5`. |
| `MECHA_OPENROUTER_CLAUDE_MODEL` | Optional MECHA Claude-lineage override. |
| `MECHA_OPENROUTER_CODEX_MODEL` | Optional MECHA Codex-lineage override. |
| `DAYTONA_API_KEY` | Full Case sandbox access. |
| `DAYTONA_TARGET` | Daytona target. Default `us`. |
| `XAI_API_KEY` | Grok coach access. It never reaches the Daytona sandbox. |
| `XAI_MODEL` / `WRINGER_GROK_MODEL` | Grok coach model. Default `grok-4.5`. |
| `GAMMA_APP_API_KEY` | Local-only Gamma presentation testing. The production sandbox never receives an unscoped Gamma key. |
| `GAMMA_MODEL` | Optional Gamma report model. Default `anthropic/claude-opus-4.1`. |
| `RESEND_API_KEY` | Optional Full Case deliverable email. |
| `RESEND_FROM_ADDRESS` | Verified sender. Default `reports@thewringer.ai`. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional public PostHog project key. |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host. Default `https://us.i.posthog.com`. |
| `ASSIST_RATE_LIMIT` | Coach requests per process window. Default `12`. |
| `ASSIST_RATE_WINDOW_MS` | Coach window. Default `3600000`. |
| `FREE_MODE` | Local-only payment bypass. Production explicitly rejects `true`. |

## Verification

```text
node scripts/smoke-draft.mjs
node scripts/smoke-rate-limit.mjs
node scripts/smoke-email.mjs
node scripts/smoke-security.mjs
node scripts/smoke-webmcp.mjs
npm run lint
npm run build
```

These checks are local and mocked. Do not call Stripe, OpenRouter, xAI, Daytona, Gamma, or Resend merely to verify a code change. A real test-mode purchase or provider smoke requires an explicit dollar cap.

## Deployment

1. Link the repository to the existing Vercel `the-wringer` project.
2. Configure production secrets in Vercel. Never commit them.
3. Keep Stripe in test mode until the complete callback, atomic claim, Quick Attack, and Full Case flows pass.
4. Run all verification commands.
5. Deploy a preview and verify WebMCP in ChatGPT's browser and Chrome 149+.
6. Promote the reviewed commit to production.

The canonical production origin is `https://www.thewringer.ai`.

## License

MIT. See [LICENSE](LICENSE).
