import ContentLayout from "../../components/ContentLayout";
import { buildMetadata } from "../../lib/seo";
import { encodeDraftParam } from "../../lib/draft";

export const metadata = buildMetadata({
  title: "AI Agent Work Order Templates",
  description:
    "Real work order templates for AI agents: password resets, sales recaps, launch checklists, bug fixes, and more. Every template prefills the Wringer form with a goal, checkable criteria, and boundaries.",
  path: "/templates",
});

const TEMPLATES = [
  {
    title: "Password reset flow",
    desc: "A small feature with clear machine checks: email arrives, new password works.",
    form: {
      goal: "Customers can reset their password and get the email within a minute",
      acs: [
        { text: "Reset email arrives in under a minute", kind: "HUMAN" },
        { text: "New password signs in successfully", kind: "AUTO" },
        { text: "Old password stops working", kind: "AUTO" },
      ],
      nonGoals: "No UI redesign, no account recovery changes, no production deploy",
      maxIterations: 25,
      preauthorized: "",
    },
  },
  {
    title: "Weekly sales recap",
    desc: "A recurring doc task: pull the week's calls into one shared note with a verdict per deal.",
    form: {
      goal: "A short weekly recap of my sales calls lands in a shared doc my team can open",
      acs: [
        { text: "Shared doc link works for the team", kind: "HUMAN" },
        { text: "One section per call with a next-step verdict", kind: "HUMAN" },
        { text: "No customer names or numbers in the doc", kind: "AUTO" },
      ],
      nonGoals: "No CRM changes, no emails to customers, no pricing discussion",
      maxIterations: 20,
      preauthorized: "",
    },
  },
  {
    title: "Launch checklist from messy notes",
    desc: "Turn scattered product notes into one launch checklist where nothing is marked done unless it is.",
    form: {
      goal: "Messy product notes become a single launch checklist with verifiable done states",
      acs: [
        { text: "Every item is a pass/fail check, not a task description", kind: "AUTO" },
        { text: "Nothing marked done without evidence attached", kind: "AUTO" },
        { text: "Checklist opens in the shared workspace", kind: "HUMAN" },
      ],
      nonGoals: "No changes to the product itself, no new features, no public posts",
      maxIterations: 25,
      preauthorized: "",
    },
  },
  {
    title: "Bug fix with regression checks",
    desc: "A fix that has to prove the bug is gone and nothing nearby broke.",
    form: {
      goal: "The double-charge bug is fixed and the checkout flow still passes",
      acs: [
        { text: "Repro case now succeeds", kind: "AUTO" },
        { text: "Checkout happy path passes end to end", kind: "AUTO" },
        { text: "No new failures in the test suite", kind: "AUTO" },
      ],
      nonGoals: "No dependency upgrades, no payment provider changes, no schema changes",
      maxIterations: 30,
      preauthorized: "",
    },
  },
  {
    title: "Content cleanup pass",
    desc: "Reformat and dedupe a docs folder without touching meaning or links.",
    form: {
      goal: "Docs folder is deduped, consistent in format, and every internal link still resolves",
      acs: [
        { text: "Duplicate pages merged with a redirect note", kind: "HUMAN" },
        { text: "Zero broken internal links after the pass", kind: "AUTO" },
        { text: "Heading style consistent across all files", kind: "AUTO" },
      ],
      nonGoals: "No rewrites of technical content, no file deletions without a list, no public changes",
      maxIterations: 25,
      preauthorized: "",
    },
  },
  {
    title: "Research digest",
    desc: "Turn a pile of links and PDFs into a tight briefing with sources cited.",
    form: {
      goal: "A one-page digest of the research with a source per claim",
      acs: [
        { text: "Every claim links to its source", kind: "AUTO" },
        { text: "Digest fits one page at 11pt", kind: "HUMAN" },
        { text: "No claims without a source attached", kind: "AUTO" },
      ],
      nonGoals: "No new research, no opinions, no outside publishing",
      maxIterations: 20,
      preauthorized: "",
    },
  },
];

const article = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "AI agent work order templates that actually verify",
      description:
        "Ready-made work orders for common AI agent jobs, each with checkable acceptance criteria and boundaries. Click any template to prefill the Wringer form.",
      publisher: { "@type": "Organization", name: "The Wringer" },
      mainEntityOfPage: "https://www.thewringer.ai/templates",
    },
    {
      "@type": "ItemList",
      name: "AI agent work order templates",
      numberOfItems: TEMPLATES.length,
      itemListElement: TEMPLATES.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t.title,
        description: t.desc,
        url: `https://www.thewringer.ai/templates#${encodeDraftParam(t.form)}`,
      })),
    },
  ],
};

export default function TemplatesPage() {
  return (
    <ContentLayout
      kicker="Templates"
      title="Work orders that start sharp"
      updated="August 8, 2026"
      article={article}
    >
      <p>
        The fastest way to see what a good work order looks like is to start from one. Each
        template below prefills the Wringer form with a goal, checkable acceptance criteria, and
        boundaries. Edit anything, then audit it for $1 before you spend on a run.
      </p>

      <h2>Pick a starting point</h2>
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <div key={t.title} className="tpl-card">
            <h3>{t.title}</h3>
            <p>{t.desc}</p>
            <a
              className="btn-stamp"
              href={`/?draft=${encodeDraftParam(t.form)}`}
            >
              Use this template
            </a>
          </div>
        ))}
      </div>

      <h2>What makes these work</h2>
      <p>
        Every template follows the same three rules. The goal names a finished state, not an
        activity. The checks are things a stranger could prove without guessing. The boundaries
        stop the agent from drifting into extra work. That is the whole difference between a
        prompt and a work order.
      </p>

      <p>
        Want to write your own?{" "}
        <a href="/guides/acceptance-criteria-for-ai-agents">
          Read the guide on acceptance criteria
        </a>{" "}
        first, then <a href="/#coach">chat with Grok</a> to draft from plain English.
      </p>
    </ContentLayout>
  );
}
