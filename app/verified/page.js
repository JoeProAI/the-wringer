import ContentLayout from "../../components/ContentLayout";
import { buildMetadata } from "../../lib/seo";
import { encodeDraftParam } from "../../lib/draft";
import { VERIFIED_CASES } from "../../lib/verified-cases";
import { SITE_URL } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Verified Wringers",
  description:
    "See what a Wringer result looks like before you pay. Four checkable questions with operator evidence, real citations, and work orders you can run yourself.",
  path: "/verified",
});

const article = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Verified Wringers: checkable questions with real evidence",
      description:
        "Operator-authored case files showing what a Wringer investigation looks like. Each case prefills the live form so you can run the same contract yourself.",
      publisher: { "@type": "Organization", name: "The Wringer" },
      mainEntityOfPage: `${SITE_URL}/verified`,
    },
    {
      "@type": "ItemList",
      name: "Verified Wringer cases",
      numberOfItems: VERIFIED_CASES.length,
      itemListElement: VERIFIED_CASES.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.question,
        description: c.summary,
        url: `${SITE_URL}/verified#${c.id}`,
      })),
    },
  ],
};

export default function VerifiedPage() {
  return (
    <ContentLayout
      kicker="Verified"
      title="See the result before you press"
      updated="August 30, 2026"
      article={article}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Verified Wringers", path: "/verified" },
      ]}
    >
      <p>
        These are operator case files, not customer work orders. Each question is checkable by
        anyone with public sources. The evidence cites real physics, not fabricated receipts. Press
        the same contract yourself if you want to verify.
      </p>

      <div className="verified-grid">
        {VERIFIED_CASES.map((c) => (
          <article key={c.id} id={c.id} className="verified-card">
            <h2>{c.question}</h2>
            <p className="verified-summary">{c.summary}</p>

            <div className="verified-section">
              <h3>Work Order</h3>
              <div className="verified-wo">
                <div className="verified-field">
                  <span className="verified-label">Goal</span>
                  <span>{c.form.goal}</span>
                </div>
                <div className="verified-field">
                  <span className="verified-label">Checks</span>
                  <ul className="verified-checks">
                    {c.form.acs.map((ac, i) => (
                      <li key={i}>
                        <span className="verified-kind mono">{ac.kind}</span> {ac.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="verified-field">
                  <span className="verified-label">Boundaries</span>
                  <span>{c.form.nonGoals}</span>
                </div>
                <div className="verified-field">
                  <span className="verified-label">Attempt budget</span>
                  <span>{c.form.maxIterations}</span>
                </div>
              </div>
            </div>

            <div className="verified-section">
              <h3>{c.evidence.label}</h3>
              <ul className="verified-notes">
                {c.evidence.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
              <div className="verified-citations">
                <span className="verified-label">Sources</span>
                <ul>
                  {c.evidence.citations.map((cite, i) => (
                    <li key={i}>
                      <a href={cite.url} target="_blank" rel="noopener noreferrer">
                        {cite.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a className="btn-stamp verified-cta" href={`/?draft=${encodeDraftParam(c.form)}`}>
              Try this contract
            </a>
          </article>
        ))}
      </div>

      <h2>What the output looks like</h2>
      <p>
        The work orders above are the input. Below is what you actually get back from a MECHA run.
        This is the real output from the sky-blue case, run by the operator with a triumvirate strategy.
      </p>

      <div className="verified-output">
        <h3>MECHA Run Output (sky-blue case)</h3>
        <div className="verified-output-stats">
          <span className="verified-stat">EXIT 0 SUCCESS</span>
          <span className="verified-stat">triumvirate strategy</span>
          <span className="verified-stat">winner: Claude (confidence 0.9)</span>
          <span className="verified-stat">model cost: $0.77 + $0.32 GAMMA</span>
        </div>

        <div className="verified-output-section">
          <h4>GAMMA HQ Report (excerpt)</h4>
          <pre className="verified-output-pre">{`# GAMMA REPORT

The multi-agent run successfully verified that Earth's daytime sky appears blue 
due to Rayleigh scattering. All three acceptance criteria were satisfied with 
peer-reviewed citations.

## Verdict

Exit status: SUCCESS (0). All criteria passed verification.
Winner: Candidate 1 (Claude) with confidence 0.9.

The winning answer correctly identifies Rayleigh scattering as the mechanism, 
cites authoritative sources (Bohren & Clothiaux, Young 1981), and explains the 
wavelength-dependent intensity relationship (I ∝ 1/λ⁴).

## Verification

The customer can verify by:
1. Checking the cited sources (NASA, HyperPhysics, Applied Optics)
2. Confirming the 1/wavelength^4 relationship in any optics textbook
3. Reviewing the cone-cell sensitivity data from CIE 1931 standards`}</pre>
        </div>

        <div className="verified-output-section">
          <h4>HD Presentation (GAMMA)</h4>
          <p className="verified-output-note">
            The HD presentation uses GPT Image 2 to generate executive-grade slides. 
            These are real slides from the operator run.
          </p>
          <div className="verified-gallery">
            <img 
              src="/examples/gamma-example-cover.png" 
              alt="GAMMA report cover: Exit SUCCESS, reviewer confidence 0.9, winner Claude"
              className="verified-gallery-img"
              loading="lazy"
            />
            <img 
              src="/examples/gamma-example-content.png" 
              alt="Rayleigh scattering explanation with scientific citations"
              className="verified-gallery-img"
              loading="lazy"
            />
            <img 
              src="/examples/gamma-example-refs.png" 
              alt="References and conclusion slide"
              className="verified-gallery-img"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <h2>What these show</h2>
      <p>
        A Wringer contract has a goal, checkable criteria, and boundaries. The audit stress-tests
        the contract. A MECHA run executes it in a sandbox and grades the result. 
        Every case here is a question a stranger can verify with public sources. That is the
        standard: if you cannot prove it without guessing, it is not a real check.
      </p>
    </ContentLayout>
  );
}
