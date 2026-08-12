import ContentLayout from "../../../components/ContentLayout";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "How to Verify AI Agent Work",
  description:
    "Do not trust the agent's report. Re-run the checks yourself, separate Auto from human checks, and demand an evidence chain. How to verify AI agent work without becoming the QA team.",
  path: "/guides/how-to-verify-ai-agent-work",
});

const article = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How to verify AI agent work: do not trust the report",
  description:
    "The report says SUCCESS. Prove it. A practical verification routine for agent output.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  datePublished: "2026-08-12",
  dateModified: "2026-08-12",
  mainEntityOfPage: "https://www.thewringer.ai/guides/how-to-verify-ai-agent-work",
};

export default function VerifyAgentWorkGuide() {
  return (
    <ContentLayout
      kicker="Guide"
      title="How to verify AI agent work: do not trust the report"
      updated="August 12, 2026"
      article={article}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: "How to verify AI agent work" },
      ]}
    >
      <p>
        The agent says it is done. The agent also wrote the summary saying it is done. Those two
        facts are why verification exists as a separate step, and why the verification has to be
        done by something other than the agent that did the work.
      </p>

      <h2>The report is a claim, not evidence</h2>
      <p>
        A confident summary is the cheapest thing an agent produces. Treat &quot;done&quot;,
        &quot;fixed&quot;, and &quot;SUCCESS&quot; as claims that need proof, not as facts.
        Everything changes when you ask one question: show me the output that proves it.
      </p>

      <h2>Re-run the checks yourself</h2>
      <p>
        The acceptance criteria are the contract. Run them. If a check says &quot;the export
        opens in Excel with one row per order&quot;, open the file and count. If it says
        &quot;the reset email arrives in under a minute&quot;, send one and watch the clock.
        Checks that are provable by command or URL are the ones you can re-run in seconds, which
        is why they matter more than opinion checks.
      </p>

      <h2>Separate Auto from human checks</h2>
      <p>
        Auto checks (commands, URLs, files, tests) can be re-run mechanically. Human checks need
        a named person to confirm one specific thing. Keep the two separate in the contract and
        in your review. An agent that passed every Auto check and skipped the human one is not
        done, no matter what the summary says.
      </p>

      <h2>Demand an evidence chain</h2>
      <p>
        For anything non-trivial, ask for the trail: which tool ran, what it returned, which
        artifact it produced, and who reviewed it. A run with a real evidence chain can be
        audited after the fact. A run with only a summary is a story.
      </p>

      <h2>Use a different reviewer than the worker</h2>
      <p>
        The strongest check is an independent one: a separate reviewer who did not do the work
        grading the acceptance criteria against the evidence. That is the entire point of the{" "}
        <a href="/mecha">MECHA run</a>: workers produce, a reviewer verifies, and you get the
        exit code plus the evidence chain back. Honest failure beats fake SUCCESS, and the exit
        code tells you which one you got.
      </p>

      <h2>When things go wrong</h2>
      <ul>
        <li>
          <strong>Unverifiable criteria:</strong> the contract is the problem. Fix the checks,
          not the agent.
        </li>
        <li>
          <strong>Vacuous pass:</strong> the check was satisfiable without doing the job.
          Rewrite it to require the artifact.
        </li>
        <li>
          <strong>Drift:</strong> the agent touched things outside its boundaries. Tighten the
          non-goals and rerun.
        </li>
      </ul>

      <p>
        Write contracts that can be verified in the first place with the{" "}
        <a href="/guides/how-to-write-an-ai-agent-work-order">work order guide</a>, start from a{" "}
        <a href="/templates">template</a>, and run the{" "}
        <a href="/audit">$1 audit</a> before a run so the checks are sharp when it matters.
      </p>
    </ContentLayout>
  );
}
