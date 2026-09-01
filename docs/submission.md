# Devpost submission draft

## Project name

The Wringer

## Tagline

Put agent work on trial before you trust it.

## What it does

The Wringer turns vague requests into checkable work orders, pressure-tests them, and can execute the strongest version through a multi-agent MECHA run that must return evidence and an honest exit code.

The WebMCP challenge extension makes those same product capabilities available as six structured browser tools. A human can tell an agent what they want in normal language. The agent discovers The Wringer's tools, creates the visible case file, reviews the verification gaps, stages a Quick Attack or Full Case, and applies the resulting repairs. The on-page Agent Docket records each tool call, finding, and confirmation handoff so the human sees and controls the same state throughout the workflow.

## Why WebMCP is a strong fit

Traditional browser agents have to infer what a work-order form means, locate controls, and hope a visual click reached the intended action. That is especially weak for a product whose purpose is precise intent, evidence, and safe execution.

WebMCP gives The Wringer a typed capability surface. Each tool has a narrow purpose, bounded JSON Schema, structured output, cancellation, explicit side-effect metadata, and visible connection to the human interface. Paid actions stop at a confirmation boundary rather than silently opening checkout or spending money.

## Human and agent collaboration

Before WebMCP, a person manually translated a request into a goal, acceptance criteria, boundaries, strategy, and agent count. They then had to inspect an audit, understand its repairs, re-enter the improved case, and monitor a run.

With WebMCP, an agent can:

1. Call `create_case_file` to turn the person's request into the live form.
2. Call `review_case_file` to identify missing checks and compile the exact contract.
3. Call `run_quick_attack` or `start_full_case` to stage the real product workflow for human confirmation.
4. Call `apply_audit_repairs` to update the same visible case file.
5. Call `get_full_case_status` to read bounded progress and the final evidence already shown to the human.

The agent does not remotely click through a duplicate demo. Both paths use the same React state, contract compiler, route adapters, payment boundary, application services, and MECHA runtime.

## Implementation

The Next.js application registers six imperative tools with `document.modelContext.registerTool()`. Tool registration is feature-detected and cleaned up with an `AbortController`. Schemas reject unknown properties and bound every string, array, strategy, iteration count, and agent count. Tool results are structured JSON strings and provider output is marked untrusted.

Server routes are thin adapters over shared services. Challenge work also added strict case validation, XML-safe contracts, a browser-bound Stripe callback, signed HttpOnly payment cookies, atomic Upstash redemption, provider-capped five-hour OpenRouter run keys, sanitized result links, a verified MECHA bundle, security headers, replay recovery, and deterministic smoke tests.

## What existed before the challenge

The Wringer was already a deployed product before August 25, 2026. It already had the human work-order form, Grok coach, $1 OpenRouter audit, Stripe checkout, Daytona MECHA runs, evidence reports, Gamma examples, guides, templates, and analytics.

The challenge branch starts from production commit `642fd77`. The WebMCP registration, six tools, shared-service extraction, human-agent status, safety hardening, tests, and challenge documentation were added during the submission period. Full evidence is in `docs/hackathon-changes.md`.

## Links

- Live application: https://www.thewringer.ai
- Public source: https://github.com/JoeProAI/the-wringer
- WebMCP documentation: https://github.com/JoeProAI/the-wringer/blob/main/docs/webmcp.md
- Challenge change record: https://github.com/JoeProAI/the-wringer/blob/main/docs/hackathon-changes.md
- Demo video: ADD PUBLIC YOUTUBE URL

## Testing instructions

1. Open the live application in ChatGPT's in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Ask the browser agent to create a bounded work order. Example: "Add password reset to my existing app. Prove the reset email arrives within one minute and the new password signs in. Do not redesign anything or contact real customers."
3. Confirm that `create_case_file` updates the visible form.
4. Ask the agent to review the case and confirm `review_case_file` returns findings and the compiled contract.
5. Ask it to stage a Quick Attack. Confirm the page requires a human click before checkout.
6. Repeat with a different request to show the behavior is not hardcoded.

Judges do not need to purchase anything to verify the WebMCP implementation. Paid tools demonstrate the explicit human confirmation boundary without creating checkout or charges.
