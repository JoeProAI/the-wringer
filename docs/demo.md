# Winning demo cut

Target: 75 to 90 seconds. One prompt, one visible defect, one human-controlled spend boundary, one repaired result.

## 0:00 to 0:08: Prove native WebMCP

Open TheWringer.ai in ChatGPT's in-app browser. Show the six discovered tools before touching the form.

Narration:

> Most agents guess their way through websites. The Wringer publishes typed capabilities instead.

## 0:08 to 0:25: Agent creates shared product state

Tell the browser agent:

> Turn this into a Wringer case file and review it: refactor password reset so a user cannot trigger a second email while the first reset link is still valid. Prove it works. Do not redesign anything or contact real customers.

The agent calls `create_case_file`, then `review_case_file`.

Keep the Agent Docket and form in frame. The docket records both tool calls while the same visible form fills in. The free readiness review should expose the missing concurrency check or another concrete verification gap.

## 0:25 to 0:42: Make human control unmistakable

Say:

> Put it through a Quick Attack.

The agent calls `run_quick_attack`. Show both:

- The tool response: `confirmation_required: true`, `checkout_started: false`, `charged: false`.
- The Wringer confirmation card: the exact $1 action is staged, but nothing has been purchased.

Narration:

> The agent can prepare paid work. It cannot spend for me.

Click **Confirm and continue** using Stripe test mode or an approved press pass.

## 0:42 to 1:10: Close the evidence loop

Show the real Quick Attack result and its verification defect. Ask:

> Apply the repaired version.

The agent calls `apply_audit_repairs`. The Agent Docket records the call and the repaired acceptance criteria replace the weak version in the same form.

Narration:

> WebMCP did not automate clicks. It let the agent understand the product, change shared state, stop at a spend boundary, and close the verification loop.

## 1:10 to 1:25: Prove it is not hardcoded

Give one short second request from a different domain and show `create_case_file` updating the form again. Do not run another paid audit.

## Final frame

Keep these visible together:

- Agent Docket with multiple tool calls.
- Repaired work order.
- Human confirmation boundary or audit verdict.
- `Native WebMCP ready · 6 tools`.

## Recording rules

- Keep the final video under three minutes and include narration.
- Show the browser's discovered tool names in the first ten seconds.
- Use only Stripe test mode, a press pass, or the explicitly approved provider cap.
- Do not expose session IDs, email addresses, API keys, provider dashboards, or private infrastructure.
- Avoid a long product tour. The mechanism is the story.
