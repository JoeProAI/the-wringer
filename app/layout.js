import "./globals.css";
import { Providers } from "./providers";
import { SITE_URL, buildMetadata } from "../lib/seo";

const homeMeta = buildMetadata({
  title: "The Wringer | Agent-native work orders, audits, and MECHA runs",
  description:
    "Humans and AI agents build the same checkable work orders through native WebMCP tools, then run a $1 audit or a $10 MECHA case that has to prove the result.",
  path: "/",
});

export const metadata = {
  ...homeMeta,
  title: {
    default: homeMeta.title,
    template: "%s · The Wringer",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "The Wringer",
      url: SITE_URL,
      logo: `${SITE_URL}/og-card.jpg`,
      sameAs: ["https://x.com/JoePro"],
    },
    {
      "@type": "WebSite",
      name: "The Wringer",
      url: SITE_URL,
      description:
        "Humans and AI agents build the same checkable work orders through WebMCP, then audit or execute them with a multi-agent swarm.",
      publisher: { "@type": "Organization", name: "The Wringer", url: SITE_URL },
    },
    {
      "@type": "SoftwareApplication",
      name: "The Wringer",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      offers: [
        {
          "@type": "Offer",
          name: "The Audit",
          price: "1.00",
          priceCurrency: "USD",
          description: "Brutal contract audit and graded dry-run of your agent work order.",
        },
        {
          "@type": "Offer",
          name: "MECHA Run",
          price: "10.00",
          priceCurrency: "USD",
          description:
            "Real multi-agent execution of your compiled work order in an isolated sandbox.",
        },
      ],
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@400;600&family=Libre+Franklin:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
