# WebMCP Challenge changes

The WebMCP Challenge submission period began August 25, 2026 at 11:00 AM PT. The Wringer existed before that date. This file separates the existing product from eligible challenge work.

## Baseline before August 25

Canonical baseline: commit `a1937073daad81e14a7bf64ca9a0cc6d48748751`, committed August 12, 2026.

The baseline already included:

- The public TheWringer.ai human interface.
- Browser-local work-order drafting, autosave, restore, and share links.
- Grok-assisted work-order drafting.
- The $1 OpenRouter audit and repaired-form workflow.
- The $10+ Stripe-gated MECHA workflow.
- Per-run Daytona sandboxes, multi-agent strategies, progress polling, evidence reports, exit codes, and Gamma deliverables.
- PostHog analytics, guides, templates, SEO metadata, sitemap, robots policy, `llms.txt`, and security contact.

These capabilities are the foundation. They are not presented as challenge work.

## Supporting changes after August 25

Commits `298162d` through `642fd77` added:

- Verified example cases.
- A production evidence-stage gallery and responsive presentation viewer.
- GPT Image 2 presentation imagery.
- Email delivery of MECHA reports and presentation links through Resend.
- Smoke coverage for verified-case draft links and email rendering.

These changes improved demonstrability but did not implement WebMCP.

## WebMCP challenge work

The `feat/webmcp-challenge` branch starts from production commit `642fd77b86ec254528b7e0f34e10d48f5cb9176c`. Eligible work on this branch includes:

- Native `document.modelContext` registration and six product tools.
- Shared application services used by both manual routes and WebMCP tools.
- Structured input validation, output contracts, cancellation, and tool lifecycle cleanup.
- Visible human confirmation for paid and outward operations.
- Payment, entitlement, run-ownership, input-bound, prompt-injection, and secret-transport hardening required to expose product actions safely.
- Upgrade to the deterministic `wringer-cloud` MECHA profile bundle with a verified manifest and bounded cloud context.
- Human-plus-agent collaboration status in the existing interface.
- WebMCP tests, browser verification, architecture documentation, and the demo flow.

## Evidence commands

```text
git diff --stat a1937073daad81e14a7bf64ca9a0cc6d48748751..642fd77b86ec254528b7e0f34e10d48f5cb9176c
git diff --stat 642fd77b86ec254528b7e0f34e10d48f5cb9176c..feat/webmcp-challenge
git log --date=iso-strict --pretty=fuller --reverse feat/webmcp-challenge
```

The first diff is existing post-cutoff supporting work. The second diff is the WebMCP implementation submitted for judging.
