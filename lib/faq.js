// Single source of truth for the homepage FAQ.
// The visible FAQ section and the FAQPage JSON-LD both render from this
// array so the structured data can never drift from what humans see.

export const FAQS = [
  {
    q: "What is The Wringer?",
    a: "It turns a vague AI agent idea into a checkable work order, then gives you two ways to use it: a $1 audit that stress-tests the contract before anything runs, or a MECHA multi-agent run that actually does the work and has to prove the result.",
  },
  {
    q: "How much does it cost?",
    a: "The Grok coach and the form are free. A work order audit is $1. A MECHA run starts at $10 and scales with the number of agents you spin up.",
  },
  {
    q: "What does the $1 audit actually do?",
    a: "It reads your goal and acceptance criteria like a hostile reviewer, finds the weak spots (vague checks, missing boundaries, unverifiable claims), and returns a graded dry run plus a repaired work order you can apply in one click.",
  },
  {
    q: "What is a MECHA run?",
    a: "MECHA dispatches your compiled work order to a real multi-agent swarm in an isolated Daytona sandbox. Workers fan out under a strategy you pick, a reviewer synthesizes the final answer, and you get the full evidence chain back.",
  },
  {
    q: "Is my work order private?",
    a: "Work orders are sent to the audit model or the sandbox only when you run them. There is no Wringer database of your prompts. For paid MECHA runs, you receive an email copy of the GAMMA report and any available presentation links at the address you used at checkout. That email is held by our mail provider (Resend) per their retention policy. The live results page is session-only.",
  },
  {
    q: "How is this different from just pasting a prompt into ChatGPT?",
    a: "A chat model gives you text. The Wringer gives you a contract with checkable acceptance criteria, then verifies the result instead of trusting it. Honest failure beats fake SUCCESS, and the exit code tells you which one you got.",
  },
];
