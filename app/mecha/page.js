import ContentLayout from "../../components/ContentLayout";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "MECHA Multi-Agent Runs",
  description:
    "MECHA dispatches your compiled work order to a real multi-agent swarm in an isolated Daytona sandbox. Pick a strategy, watch live telemetry, and get the full evidence chain back.",
  path: "/mecha",
});

const article = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MECHA runs: real multi-agent execution with an evidence chain",
  description:
    "How MECHA runs work, what strategies you can pick, and what you get back from a sandboxed swarm.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  mainEntityOfPage: "https://www.thewringer.ai/mecha",
};

export default function MechaPage() {
  return (
    <ContentLayout
      kicker="MECHA Run"
      title="A multi-agent run that has to prove the result"
      updated="August 8, 2026"
      article={article}
    >
      <p>
        The audit checks the contract. The MECHA run executes it. Your compiled work order gets
        dispatched to a real multi-agent swarm inside an isolated Daytona sandbox, and the run is
        not done until the acceptance criteria are verified by a separate reviewer.
      </p>

      <h2>How a run works</h2>
      <ol>
        <li>
          <strong>You build a work order.</strong> Goal, acceptance criteria, non-goals, budget.
          Grok can draft it from plain English.
        </li>
        <li>
          <strong>Pick a strategy.</strong> The swarm fans out under senate, triumvirate, best-of-3,
          or a solo lineage, with workers from Claude, Codex, and Grok lines via OpenRouter.
        </li>
        <li>
          <strong>Watch it run.</strong> Live telemetry streams from the sandbox as workers post
          evidence. Runs take minutes, not seconds.
        </li>
        <li>
          <strong>Get the verdict.</strong> A reviewer synthesizes the final answer and the full
          evidence chain. You get the report, the exit code, and the artifacts.
        </li>
      </ol>

      <h2>Pricing</h2>
      <p>
        Runs start at $10. Scale the number of agents and the price moves up with the compute you
        are actually using, capped so a runaway swarm cannot surprise you.
      </p>

      <h2>Why sandboxed matters</h2>
      <p>
        The sandbox keeps the swarm from touching anything outside the job. No stray pushes, no
        emails to real customers, no side effects beyond the workspace you gave it. Combined with
        the contract&apos;s explicit preauthorized list, that is the difference between an agent
        that explores and an agent that wanders.
      </p>

      <h2>When to run MECHA</h2>
      <ul>
        <li>When the job is real and the contract has been audited</li>
        <li>When you want the result verified by an independent reviewer, not the same model that
          did the work</li>
        <li>When a single chat answer is not enough evidence for a decision</li>
      </ul>

      <p>
        <a href="/audit">Run the $1 audit first</a>, then{" "}
        <a href="/#coach">build the work order</a> that survives it.
      </p>
    </ContentLayout>
  );
}
