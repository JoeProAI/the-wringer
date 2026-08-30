import { SITE_URL } from "../lib/seo";

// Static lastmod: content pages only change when we ship a content pass,
// and build-time new Date() makes every URL look freshly changed on every
// deploy. Bump this constant when the pages actually change.
const LAST_MOD = "2026-08-30T00:00:00.000Z";

const PAGES = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/audit", priority: 0.9, freq: "monthly" },
  { path: "/mecha", priority: 0.9, freq: "monthly" },
  { path: "/templates", priority: 0.8, freq: "monthly" },
  { path: "/verified", priority: 0.8, freq: "monthly" },
  { path: "/guides", priority: 0.7, freq: "monthly" },
  { path: "/guides/acceptance-criteria-for-ai-agents", priority: 0.8, freq: "monthly" },
  { path: "/guides/why-ai-agents-need-a-dry-run", priority: 0.8, freq: "monthly" },
  { path: "/guides/how-to-write-an-ai-agent-work-order", priority: 0.8, freq: "monthly" },
  { path: "/guides/how-to-verify-ai-agent-work", priority: 0.8, freq: "monthly" },
];

export default function sitemap() {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: LAST_MOD,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
