import ContentLayout from "../../components/ContentLayout";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Guides: writing work orders for AI agents",
  description:
    "Practical guides on AI agent work orders: how to write acceptance criteria agents can actually verify, and why a $1 dry run beats a $10 sandbox burn.",
  path: "/guides",
});

const article = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  headline: "The Wringer guides",
  description: "How to write AI agent work orders that verify, and why dry runs exist.",
  publisher: { "@type": "Organization", name: "The Wringer" },
  mainEntityOfPage: "https://www.thewringer.ai/guides",
};

export default function GuidesPage() {
  return (
    <ContentLayout kicker="Guides" title="Write work orders that survive contact" updated="August 8, 2026" article={article}>
      <div className="tpl-grid">
        <div className="tpl-card">
          <h3>Acceptance criteria for AI agents</h3>
          <p>
            The difference between a prompt and a work order is verifiable checks. How to write
            criteria an agent cannot weasel out of.
          </p>
          <a className="btn-stamp" href="/guides/acceptance-criteria-for-ai-agents">
            Read the guide
          </a>
        </div>
        <div className="tpl-card">
          <h3>Why AI agents need a dry run</h3>
          <p>
            Most agent failures are baked into the contract before the first tool call. A $1 dry
            run finds them while the only thing at risk is a dollar.
          </p>
          <a className="btn-stamp" href="/guides/why-ai-agents-need-a-dry-run">
            Read the guide
          </a>
        </div>
      </div>

      <h2>Start from a template</h2>
      <p>
        Prefer to skip straight to a starting point? The{" "}
        <a href="/templates">work order templates</a> page has six ready-made contracts that
        prefill the form in one click.
      </p>
    </ContentLayout>
  );
}
