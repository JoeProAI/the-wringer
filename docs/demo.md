# Three-minute demo

## 0:00 to 0:25: The existing product

Open TheWringer.ai. Show the normal work-order form, $1 audit, and MECHA evidence stage. State that humans can still use every control directly.

## 0:25 to 1:10: Agent creates the case

Tell the browser agent:

> Turn my rough request into a Wringer case file: add password reset to an existing app, prove the email arrives within one minute and the new password signs in, don't redesign anything or contact real customers.

The agent discovers `create_case_file`, invokes it with structured arguments, and the visible form updates immediately. It then calls `review_case_file` and explains the returned validation and compiled contract.

## 1:10 to 1:55: Agent operates the real workflow

Ask:

> Put this through a Quick Attack.

The agent calls `run_quick_attack`. The Wringer displays the exact $1 operation and requires human confirmation. Use an approved test pass or prerecorded test-mode entitlement. Show the real audit result, then ask:

> Apply the repaired version.

The agent calls `apply_audit_repairs`, and the same visible form updates.

## 1:55 to 2:35: Second, non-hardcoded interaction

Load a different verified case or dictate a different task. Ask the agent to configure a Full Case using `triumvirate`, then call `start_full_case`. Show the confirmation boundary and use a previously captured real run for progress if a live run would exceed the video window. Call `get_full_case_status` and show structured progress, evidence, verdict, and cost receipt reflected in the page.

## 2:35 to 2:55: Why WebMCP

Explain the difference in one sentence:

> The agent did not guess coordinates or scrape button text. It discovered typed product capabilities, passed validated arguments, and operated the same state and services as the human interface.

End on the human-visible repaired case and evidence report.

## Recording rules

- Keep the final video under three minutes and include narration.
- Show the browser agent's discovered tool names at least once.
- Use only test mode, a press pass, or an explicitly approved capped provider run.
- Do not expose session IDs, email addresses, API keys, provider dashboards, or private repository details.
- Use a second prompt so the demo cannot be mistaken for a hardcoded script.
