import JsonLd from "./JsonLd";
import { SITE_URL } from "../lib/seo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/audit", label: "$1 Audit" },
  { href: "/mecha", label: "MECHA runs" },
  { href: "/templates", label: "Templates" },
  { href: "/guides", label: "Guides" },
];

export default function ContentLayout({ kicker, title, updated, article = null, crumbs = null, children }) {
  const trail =
    crumbs || [
      { name: "Home", path: "/" },
      { name: title, path: undefined },
    ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: `${SITE_URL}${c.path === "/" ? "" : c.path}` } : {}),
    })),
  };
  return (
    <div className="content-page">
      <nav className="content-nav">
        <a className="content-brand" href="/">
          THE <span className="red">WRINGER</span>
        </a>
        <div className="content-nav-links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="content-main">
        <header className="content-head">
          {kicker && <p className="kicker mono">{kicker}</p>}
          <h1>{title}</h1>
          {updated && <p className="content-date">Last updated {updated}</p>}
        </header>
        {article && <JsonLd data={article} />}
        <JsonLd data={breadcrumbLd} />
        <div className="content-body">{children}</div>

        <section className="content-cta">
          <h2>Put your next agent task through the press</h2>
          <p>
            Talk to Grok, get a tight work order, and hit it with a $1 audit before anything
            expensive runs.
          </p>
          <div className="content-cta-btns">
            <a className="btn-stamp" href="/#coach">
              Chat with Grok
            </a>
            <a className="btn-outline" href="/">
              Start a work order
            </a>
          </div>
        </section>
      </main>

      <footer className="content-footer">
        <div className="footer-links">
          <a href="/">Home</a>
          <a href="/audit">$1 Audit</a>
          <a href="/mecha">MECHA runs</a>
          <a href="/templates">Work order templates</a>
          <a href="/guides/acceptance-criteria-for-ai-agents">Acceptance criteria</a>
          <a href="/guides/why-ai-agents-need-a-dry-run">Dry runs</a>
        </div>
        <p>
          Built by{" "}
          <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">
            @JoePro
          </a>
          . One paid run, one honest verdict.
        </p>
      </footer>
    </div>
  );
}
