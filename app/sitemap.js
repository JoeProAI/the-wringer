import { SITE_URL } from "../lib/seo";

const PAGES = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/audit", priority: 0.9, freq: "monthly" },
  { path: "/mecha", priority: 0.9, freq: "monthly" },
  { path: "/templates", priority: 0.8, freq: "monthly" },
  { path: "/guides", priority: 0.7, freq: "monthly" },
  { path: "/guides/acceptance-criteria-for-ai-agents", priority: 0.8, freq: "monthly" },
  { path: "/guides/why-ai-agents-need-a-dry-run", priority: 0.8, freq: "monthly" },
];

export default function sitemap() {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: new Date(),
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
