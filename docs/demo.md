# Winning demo cut

Target: 60 to 75 seconds. No purchase is required. One prompt, one visible defect, one repair, one human-controlled spend boundary.

## 0:00 to 0:08: Prove native WebMCP

Open TheWringer.ai in ChatGPT's in-app browser. Show the six discovered tools before touching the form.

Narration:

> Most agents guess their way through websites. The Wringer publishes typed capabilities instead.

## 0:08 to 0:32: Agent creates, reviews, and repairs shared state

Tell the browser agent:

> Turn this into a Wringer case file, review what cannot be verified, then repair those gaps by updating the case file again: refactor password reset so a user cannot trigger a second email while the first reset link is still valid. Do not redesign anything or contact real customers.

The intended tool sequence is:

1. `create_case_file` writes the first structured work order into the visible form.
2. `review_case_file` exposes the missing concurrency check, machine check, or falsifiable expected signal.
3. `create_case_file` replaces the weak draft with the repaired version.

Keep the Agent Docket and form in frame. The docket records every tool call while the same visible form changes. This entire loop is free and deterministic.

## 0:32 to 0:52: Make human control unmistakable

Say:

> Stage a Quick Attack on the repaired case.

The agent calls `run_quick_attack`. Show both:

- The tool response: `confirmation_required: true`, `checkout_started: false`, `charged: false`.
- The Wringer confirmation card: the exact $1 action is staged, but nothing has been purchased.

Narration:

> The agent can understand the product, repair the work, and prepare a paid action. It cannot spend for me.

Do not click the confirmation button in the judge-facing demo. The point is that the agent stops correctly.

## 0:52 to 1:05: Close the argument

Pan across the Agent Docket, repaired acceptance criteria, and confirmation card in one frame.

Narration:

> WebMCP did not automate clicks. It let the agent operate real product state and hand control back at the exact trust boundary.

## Optional proof cut

After the core 60-second story, add up to 15 seconds showing an existing verified MECHA result and evidence ledger. Do not make the paid provider run the main demo dependency.

## Recording rules

- Keep the final video under three minutes and include narration.
- Show the browser's discovered tool names in the first ten seconds.
- Keep the free create-review-repair loop uncut so it cannot be mistaken for a prerecorded result.
- Do not expose session IDs, email addresses, API keys, provider dashboards, or private infrastructure.
- Avoid a long product tour. The mechanism is the story.
