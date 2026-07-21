import "./globals.css";
import { Providers } from "./providers";

const SITE_URL = process.env.SITE_URL || "https://thewringer.ai";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Wringer  -  Turn vague agent ideas into real work orders",
    template: "%s · The Wringer",
  },
  description:
    "Describe what you want an AI agent to do. The Wringer turns it into a clear goal, checkable criteria, and either a $1 brutal audit or a $10 multi-agent MECHA run. Honest failure beats fake SUCCESS.",
  keywords: [
    "AI agent work order",
    "agent prompt audit",
    "multi-agent orchestration",
    "MECHA",
    "Loop Protocol",
    "acceptance criteria for AI agents",
    "AI task verification",
    "The Wringer",
  ],
  authors: [{ name: "JoePro", url: "https://x.com/JoePro" }],
  creator: "JoePro",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "The Wringer  -  Put your agent task through the press",
    description:
      "Stop feeding agents mushy goals. Get a tight work order, a $1 audit, or a real multi-agent run for $10. No fabricated SUCCESS.",
    url: SITE_URL,
    siteName: "The Wringer",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "The Wringer  -  put your agent task through the press",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wringer",
    description:
      "Turn vague agent ideas into checkable work orders. $1 audit or $10 multi-agent execution.",
    images: ["/og-card.jpg"],
    creator: "@JoePro",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "The Wringer",
      url: SITE_URL,
      description:
        "Turn vague AI agent ideas into clear work orders, then audit or execute them with a multi-agent swarm.",
      publisher: { "@type": "Person", name: "JoePro", url: "https://x.com/JoePro" },
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
          description: "Real multi-agent execution of your compiled work order in an isolated sandbox.",
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
