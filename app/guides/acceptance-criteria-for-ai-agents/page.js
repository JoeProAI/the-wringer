import ContentLayout from "../../../components/ContentLayout";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "Acceptance Criteria for AI Agents",
  description:
    "How to write acceptance criteria an AI agent cannot fake: checkable, verifiable by a stranger, and impossible to pass vacuously. With before and after examples.",
  path: "/guides/acceptance-criteria-for-ai-agents",
});

const article = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Acceptance criteria for AI agents: write checks that cannot be faked",
  description:
    "Vague criteria let agents report success without doing the job. Here is how to write checks a stranger can verify.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  datePublished: "2026-08-08",
  dateModified: "2026-08-08",
  mainEntityOfPage: "https://www.thewringer.ai/guides/acceptance-criteria-for-ai-agents",
};

export default function AcceptanceCriteriaGuide() {
  return (
    <ContentLayout
      kicker="Guide"
      title="Acceptance criteria for AI agents: write checks that cannot be faked"
      updated="August 8, 2026"
      article={article}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: "Acceptance criteria for AI agents" },
      ]}
    >
      <p>
        When an agent run goes wrong, it rarely goes wrong at the tool call. It goes wrong at the
        acceptance criteria. The agent did what the words said, and the words did not say what
        you meant.
      </p>

      <h2>The test: could a stranger prove it?</h2>
      <p>
        Every acceptance criterion should be checkable by someone who has never met you, never
        read your mind, and is mildly hostile. If a stranger cannot prove the check passes or
        fails, neither can a verifier, which means the agent can claim success and be right.
      </p>

      <h3>Vague check</h3>
      <blockquote>Fix the login flow.</blockquote>
      <p>
        What does fixed mean? Faster? Fewer steps? Different error text? Nobody can grade this,
        including the agent. It will do something plausible and report SUCCESS.
      </p>

      <h3>Checkable check</h3>
      <blockquote>
        A user with a valid account can sign in from the login page and reach the dashboard.
        Wrong password shows a clear error and does not lock the account.
      </blockquote>
      <p>
        A stranger can run this. They know what passing looks like, and they know what failing
        looks like. That is the entire bar.
      </p>

      <h2>Three failure modes to kill</h2>

      <h3>1. Activity instead of outcome</h3>
      <p>
        &quot;Implement the export feature&quot; describes work, not a finished state. Outcome
        phrasing: &quot;Export produces a CSV that opens in Excel with one row per order.&quot;
      </p>

      <h3>2. Vacuous passes</h3>
      <p>
        A check the agent can pass without doing the job is worse than no check. &quot;Handle
        errors gracefully&quot; passes by doing nothing when there are no errors. Instead:
        &quot;When the payment API returns 500, the user sees a retry message and no charge is
        recorded.&quot;
      </p>

      <h3>3. Unverifiable claims</h3>
      <p>
        &quot;Improve performance&quot; cannot be graded. &quot;Homepage loads in under 1.5
        seconds on a mid-range phone over 4G&quot; can. Same for &quot;robust&quot; (grade by a
        concrete failure scenario), &quot;clean&quot; (grade by the lint command), and
        &quot;user-friendly&quot; (grade by the three-step path).
      </p>

      <h2>Non-goals are half the contract</h2>
      <p>
        Boundaries are acceptance criteria in disguise. An agent with no non-goals will refactor,
        upgrade, and &quot;improve&quot; its way past your deadline. Write the list of what it
        must not touch: no dependency upgrades, no redesign, no production deploy, no emails to
        real customers.
      </p>

      <h2>A template that works</h2>
      <pre>{`Goal: A finished state, one sentence.
Checks:
  - Auto: provable by command, URL, file, or test
  - Human: a named person confirms one specific thing
Boundaries: what the agent must not touch
Budget: how many attempts before it must stop`}</pre>

      <p>
        <a href="/templates">Grab a ready-made work order template</a>, or{" "}
        <a href="/#coach">chat with Grok</a> to turn plain English into a contract. Then run the{" "}
        <a href="/audit">$1 audit</a> to see how a hostile reviewer grades it.
      </p>
    </ContentLayout>
  );
}
