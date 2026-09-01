# Devpost submission

## Project name

The Wringer

## Tagline

Put agent work on trial before you trust it.

## Inspiration

AI agents can complete increasingly consequential work, but the instruction they receive is often a vague sentence and the result is often accepted without evidence. That creates two failures: the agent does the wrong job because the request was underspecified, or it claims success without proving the result.

The Wringer already helped humans turn rough requests into checkable work orders, stress-test those contracts, and execute them through a multi-agent MECHA run. WebMCP revealed the missing half of the product: the agent itself should be able to understand and operate that verification workflow without guessing at buttons, scraping the page, or creating a second agent-only interface.

We built the challenge extension around one question: what if a website could help an agent challenge its own instructions before either the agent or the human trusted the outcome?

## What it does

The Wringer turns vague agent work into a structured case file containing a finished-state goal, acceptance criteria, boundaries, an iteration budget, and explicit authorization for risky actions.

Through six native WebMCP tools, a compatible browser agent can:

- `create_case_file` to write a structured request into the same visible form a human uses.
- `review_case_file` to expose missing machine checks and unfalsifiable expected signals.
- `run_quick_attack` to stage a $1 adversarial contract audit.
- `apply_audit_repairs` to put a repaired contract back into the shared case file.
- `start_full_case` to stage a real sandboxed MECHA execution.
- `get_full_case_status` to read bounded progress, evidence, verdict, and cost information.

The Agent Docket makes each tool call, finding, repair, and approval handoff visible on the page. Read operations remain read-only. Paid operations can be prepared by the agent, but they stop at a visible human confirmation card. The tool response explicitly reports `confirmation_required: true`, `checkout_started: false`, and `charged: false`.

The normal interface remains fully functional in browsers without WebMCP.

## How we built it

The Wringer is a Next.js 14 and React 18 application deployed on Vercel. We added a dedicated WebMCP adapter using the current `document.modelContext.registerTool()` API, strict JSON Schema inputs, registration `AbortSignal` cleanup, execution cancellation, accurate `readOnlyHint` metadata, and `untrustedContentHint` for provider-derived output.

WebMCP is not a duplicate implementation. The human interface and browser tools operate the same React state, contract compiler, route adapters, application services, payment boundary, and MECHA runtime. Server routes remain thin adapters over reusable services.

The production system uses Stripe Checkout for paid entitlements, Upstash Redis for atomic payment redemption and bounded replay recovery, OpenRouter for Quick Attack and scoped MECHA model access, xAI for the Grok coach, Daytona for isolated per-run sandboxes, Resend for optional deliverables, and PostHog for product analytics.

Challenge work also hardened the boundaries required to expose real product actions safely. It added XML-safe contract compilation, bounded input validation, a browser-bound Stripe callback, signed HttpOnly payment cookies, atomic claim consumption, per-run five-hour OpenRouter keys capped to the purchased budget, sanitized links, run ownership checks, security headers, replay recovery, and deterministic smoke tests.

The Wringer existed before the challenge. The canonical pre-challenge baseline is commit `a193707`, dated August 12, 2026. Supporting product work between `298162d` and `642fd77` improved examples and deliverables but did not implement WebMCP. The challenge branch starts from `642fd77`; the WebMCP tools, shared-service extraction, Agent Docket, security hardening, tests, browser verification, and documentation were added during the submission period. The complete boundary is documented in `docs/hackathon-changes.md`.

## Challenges we ran into

The biggest challenge was making WebMCP operate a real paid product rather than a disconnected demonstration. Once an agent can stage audits and multi-agent runs, schema validation alone is not enough. Authorization, payment redemption, replay behavior, ownership, provider credentials, cancellation, and human approval all become part of the tool contract.

Our security review found several boundaries that were acceptable for a human-only prototype but unsafe for an agent-accessible workflow. Payment consumption needed to become atomic. Checkout callbacks needed to stop trusting request origins. Stripe session IDs needed protection as bearer capabilities. Sandbox credentials needed narrower transport. Provider output and links needed to be treated as untrusted. We fixed those issues before exposing the workflows.

WebMCP is also evolving. Chrome's testing implementation and current examples did not always present input schemas and execution arguments identically. Keeping all direct browser API usage in a small adapter, maintaining a capability smoke test, and verifying against Chrome 150 and ChatGPT's in-app browser prevented specification details from leaking throughout the application.

The final challenge was demonstration clarity. A successful tool call is invisible unless the human can see what changed. That led to the Agent Docket and the explicit confirmation card, which make the collaboration legible without turning the product into another chat window.

## Accomplishments that we're proud of

- Six focused native WebMCP tools operate the production product rather than a mock catalog or challenge-only page.
- ChatGPT's in-app browser can create, review, repair, and stage a case against shared visible application state.
- The free judge flow reveals two concrete verification gaps, repairs them, and reaches the approval boundary without purchase or provider inference.
- Paid and outward actions remain under human control. The agent cannot silently open checkout or spend money.
- The UI and WebMCP paths share business logic instead of drifting into separate implementations.
- Production health confirms the payment ledger, signed-cookie boundary, Stripe, Quick Attack, and Full Case provider boundaries are configured.
- The repository is public, MIT licensed, documented, reproducible, and explicit about what existed before the challenge.
- Chrome 150 discovered all six tools and executed the deployed create, review, repair, and confirmation sequence through `document.modelContext`.

## What we learned

Agent-native does not mean adding a chatbot. It means publishing precise intentions, keeping state shared and visible, and enforcing trust boundaries on the server.

A strict JSON Schema improves reliability, but it is not authorization. A valid tool call can still target the wrong resource, replay a paid entitlement, cross a user's ownership boundary, or trigger an irreversible action. The same authorization and audit expectations must apply whether the caller is a person, ChatGPT, or Devin.

We also learned that human-agent collaboration needs a visual grammar. The Agent Docket tells the human what the agent called and what changed. The confirmation card makes the moment of responsibility unmistakable. Those interface elements did more for trust than exposing additional tools would have.

Finally, fewer complete tools beat a broad unfinished surface. Each submitted tool has a precise purpose, strict schema, structured result, lifecycle behavior, error path, metadata, test coverage, and documentation.

## What's next for The Wringer

The first post-hackathon target is to strengthen the WebMCP adapter into a versioned compatibility layer and add a structured audit wrapper with Trace IDs around every tool call and meaningful state change.

After that, The Wringer will grow from case-based execution into a provider-independent orchestration platform with authenticated users, projects, tasks, persistent runs, agents, artifacts, approvals, audit history, integrations, and usage records. Vercel will continue to host the web application, while persistent control and worker services will move behind a documented backend boundary, with Railway as the current target.

Devin will be the first primary engineering provider behind a normalized adapter, not the product architecture itself. Additional providers will be added only when their capabilities can be represented honestly. Runs will survive browser closure and frontend redeployment, consequential actions will retain explicit approval boundaries, and the normal human interface will continue to work when WebMCP is unavailable.

## Submission links

- Live application: https://www.thewringer.ai
- Public source: https://github.com/JoeProAI/the-wringer
- WebMCP documentation: https://github.com/JoeProAI/the-wringer/blob/main/docs/webmcp.md
- Challenge change record: https://github.com/JoeProAI/the-wringer/blob/main/docs/hackathon-changes.md
- Demo video: ADD PUBLIC YOUTUBE URL

## Testing instructions

1. Open the live application in ChatGPT's in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Ask the agent to create a bounded work order.
3. Confirm that `create_case_file` updates the visible form and Agent Docket.
4. Ask it to review the case and confirm `review_case_file` returns concrete findings.
5. Ask it to repair those findings by calling `create_case_file` again.
6. Ask it to stage a Quick Attack and confirm the page requires a human action before checkout.

Judges do not need to purchase anything. The free flow demonstrates native discovery, shared state, structured review, repair, and the explicit human confirmation boundary.
