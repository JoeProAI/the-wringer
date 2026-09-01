# WebMCP in The Wringer

The Wringer exposes a deliberately small set of browser-native tools through `document.modelContext`. These tools let a browser agent operate the same case file, audit, and MECHA workflows as a human without scraping labels or clicking through the interface.

## Product architecture

```text
Human UI ----\
              shared case and run services ---- Stripe / OpenRouter / Daytona / xAI
WebMCP tools -/
```

WebMCP is an adapter over existing product actions. It is not a second application and it does not have a separate data model.

## Tools

| Tool | Effect | Confirmation |
|---|---|---|
| `create_case_file` | Validates structured intent, saves the draft, and updates the visible form | None |
| `review_case_file` | Returns the normalized case, validation findings, compiled contract, and available tiers | None; read-only |
| `run_quick_attack` | Stages the real $1 audit flow against the current case | Human confirmation before checkout or provider work |
| `apply_audit_repairs` | Applies the latest repaired case to the visible form | None |
| `start_full_case` | Stages a purchased MECHA run with an allowlisted strategy and agent count | Human confirmation before checkout or cloud execution |
| `get_full_case_status` | Reads bounded progress and the final structured report already visible in the page | None; read-only |

Every schema rejects unknown properties and bounds strings, arrays, iteration counts, strategy names, and agent counts. Provider output is marked untrusted. Fetches accept the browser's cancellation signal.

## Shared state

The page remains authoritative for the active draft and visible result. A successful tool call updates the same React state and browser storage used by manual controls. The Agent Docket records the tool, outcome, readiness findings, and any pending confirmation so a human can immediately inspect or change what the agent produced.

Paid actions are intentionally different from local state updates. An agent can prepare the exact action, but it cannot silently create a charge, start a sandbox, or authorize an outward action. The page displays the pending operation for human approval.

## Browser support

The implementation feature-detects `document.modelContext`. It keeps the human interface fully functional when WebMCP is unavailable.

Judges can use either:

- ChatGPT's in-app browser, which supports WebMCP.
- Chrome 149 or later with `chrome://flags/#enable-webmcp-testing` enabled.

## Security boundaries

- Browser input, tool input, provider output, run identifiers, and payment identifiers are untrusted.
- Tool responses never contain provider credentials or raw payment secrets.
- Paid operations require exact server-side entitlement checks and visible confirmation.
- Checkout callbacks require a browser-bound nonce, then exchange the Stripe session for a signed, Secure, HttpOnly, SameSite-strict cookie.
- Atomic Redis claims prevent concurrent redemption; Quick Attack replay content expires after 24 hours while a content-free tombstone blocks later reuse.
- Full Cases receive a per-run OpenRouter key with a provider-enforced dollar cap and five-hour expiry; the management key stays server-side.
- Case content is length-bounded before it reaches a provider or sandbox.
- A status request cannot start or extend a stopped sandbox.
- Foreign and missing runs return the same not-found response.
- No WebMCP tool exposes arbitrary commands, files, environment values, URLs, models, or provider selection.

## Local verification

```text
node scripts/smoke-webmcp.mjs
node scripts/smoke-draft.mjs
node scripts/smoke-rate-limit.mjs
npm run lint
npm run build
```

Provider and payment tests must remain mocked unless a capped test-mode run is explicitly approved.
