import ContentLayout from "../../../components/ContentLayout";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "How to Write an AI Agent Work Order",
  description:
    "The four parts of a work order that survives contact with an agent: a goal that names a finished state, checkable acceptance criteria, boundaries, and a budget. With a full before and after example.",
  path: "/guides/how-to-write-an-ai-agent-work-order",
});

const article = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How to write an AI agent work order: goal, checks, boundaries",
  description:
    "A work order is a prompt with teeth. Here are the four parts and a before and after example.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  datePublished: "2026-08-12",
  dateModified: "2026-08-12",
  mainEntityOfPage: "https://www.thewringer.ai/guides/how-to-write-an-ai-agent-work-order",
};

export default function HowToWorkOrderGuide() {
  return (
    <ContentLayout
      kicker="Guide"
      title="How to write an AI agent work order: goal, checks, boundaries"
      updated="August 12, 2026"
      article={article}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: "How to write an AI agent work order" },
      ]}
    >
      <p>
        A prompt asks an agent to do something. A work order tells it what done means, how to
        prove it, and what to leave alone. Same input, very different outcome. Here are the four
        parts, in the order that matters.
      </p>

      <h2>1. The goal names a finished state</h2>
      <p>
        The goal is one sentence describing the world after the job is done, not the work itself.
        &quot;Implement the export feature&quot; describes activity. &quot;Export produces a CSV
        with one row per order that opens in Excel&quot; describes a finished state. If you can
        attach &quot;...and I will know because&quot; to the goal, you are close.
      </p>

      <h2>2. Acceptance criteria are checkable by a stranger</h2>
      <p>
        Every criterion should be provable by someone who has never met you and is mildly
        hostile. If a stranger cannot grade it, neither can a verifier, and the agent can report
        SUCCESS while being technically correct. Prefer Auto checks (provable by command, URL,
        file, or test) over &quot;feels right&quot; checks. See the{" "}
        <a href="/guides/acceptance-criteria-for-ai-agents">
          full guide on acceptance criteria
        </a>
        .
      </p>

      <h2>3. Boundaries are half the contract</h2>
      <p>
        Non-goals are acceptance criteria in disguise. Without them the agent will refactor,
        upgrade, and &quot;improve&quot; its way past your deadline. Write what it must not
        touch: no dependency upgrades, no redesign, no production deploy, no emails to real
        customers. Short list, plain words.
      </p>

      <h2>4. Budget and preauthorization</h2>
      <p>
        Set how many attempts the agent gets before it must stop, and list any outward or
        irreversible actions it is allowed to take, word for word. Leave the risky list empty
        unless you mean it. A contract with no budget can loop forever; a contract with no
        preauthorized list cannot ship anything.
      </p>

      <h2>Before and after</h2>
      <h3>Before (a prompt)</h3>
      <blockquote>Make me a weekly sales recap and put it somewhere my team can see it.</blockquote>
      <h3>After (a work order)</h3>
      <pre>{`Goal: A short weekly recap of my sales calls lands in a shared doc my team can open.
Checks:
  - Auto: shared doc link resolves for the team
  - Auto: one section per call with a next-step verdict
  - Auto: no customer names or numbers in the doc
Boundaries: no CRM changes, no emails to customers, no pricing discussion
Budget: 20 attempts`}</pre>

      <p>
        Start from a{" "}
        <a href="/templates">ready-made work order template</a>, let{" "}
        <a href="/#coach">Grok draft one from plain English</a>, then run the{" "}
        <a href="/audit">$1 audit</a> before anything expensive. And when it runs,{" "}
        <a href="/guides/how-to-verify-ai-agent-work">verify the work instead of trusting the report</a>.
      </p>
    </ContentLayout>
  );
}
