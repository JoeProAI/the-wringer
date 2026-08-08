import ContentLayout from "../../components/ContentLayout";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "The $1 AI Agent Audit",
  description:
    "A $1 audit that reads your AI agent work order like a hostile reviewer: vague checks, missing boundaries, unverifiable claims, plus a repaired contract you can apply in one click.",
  path: "/audit",
});

const article = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The $1 AI agent audit: stress-test the contract before anything runs",
  description:
    "What the Wringer audit does, what you get back, and why a $1 dry run beats a $10 sandbox burn.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  mainEntityOfPage: "https://www.thewringer.ai/audit",
};

export default function AuditPage() {
  return (
    <ContentLayout
      kicker="The Audit"
      title="The $1 audit that reads your work order like a hostile reviewer"
      updated="August 8, 2026"
      article={article}
    >
      <p>
        Most agent failures are decided before the agent ever runs. The goal is mushy, the checks
        are unverifiable, and the boundaries are missing. The audit finds those problems while the
        only thing at risk is one dollar.
      </p>

      <h2>What the audit does</h2>
      <p>
        You hand it a work order: a goal, acceptance criteria, non-goals, and a budget. The auditor
        reads it like a reviewer who is trying to break it. It looks for the specific failure modes
        that make agent runs burn time and money:
      </p>
      <ul>
        <li>Acceptance criteria that cannot be proven by a command, URL, file, or human check</li>
        <li>Goals that describe activity instead of a finished state</li>
        <li>Missing boundaries that let the agent drift into extra work</li>
        <li>Checks that the agent could pass vacuously without doing the job</li>
        <li>A contract too vague for any verifier to grade honestly</li>
      </ul>

      <h2>What you get back</h2>
      <p>
        A graded dry run with an exit code, notes on every acceptance criterion, and a repaired
        work order. When the auditor emits a repaired form, the site shows a{" "}
        <strong>Use audit repairs</strong> button that drops the cleaned contract straight back into
        the form. Review it, edit it, and you are ready to run.
      </p>

      <h2>Why a $1 dry run beats a $10 burn</h2>
      <p>
        A MECHA run is real execution: a swarm of agents, a sandbox, model costs, minutes of your
        time. Running that on a contract nobody checked is how you get a confident-looking report
        about the wrong thing. The audit is the cheap pass that catches the contract problems while
        the only thing at risk is a dollar.
      </p>

      <h2>What the audit is not</h2>
      <ul>
        <li>Not a code review of your repo. It reviews the work order, not the codebase.</li>
        <li>Not a guarantee. It raises the odds that a run verifies cleanly; it cannot make a bad
          job good.</li>
        <li>Not a human consultant. It is an AI reviewer with a strict protocol and an honest
          failure mode.</li>
      </ul>

      <p>
        <a href="/#coach">Chat with Grok to build a work order</a>, then run the $1 audit before
        you spend on a MECHA run.
      </p>
    </ContentLayout>
  );
}
