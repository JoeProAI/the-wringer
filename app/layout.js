import "./globals.css";

const SITE_URL = process.env.SITE_URL || "https://thewringer.ai";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "The Wringer — Put your agent task through the press",
  description:
    "Write what you actually want your agent to do. The Wringer compiles it into Loop Protocol v5.0, audits it for $1, or executes it for real through the MECHA multi-agent orchestrator for $10. No fabricated SUCCESS.",
  keywords: ["AI agents", "agent prompts", "loop protocol", "prompt audit", "multi-agent", "MECHA"],
  openGraph: {
    title: "The Wringer",
    description:
      "Put your agent task through the press. $1 brutal contract audit, $10 real multi-agent execution. No fabricated SUCCESS.",
    url: SITE_URL,
    siteName: "The Wringer",
    type: "website",
    images: [{ url: "/og-card.jpg", width: 1536, height: 1024, alt: "The Wringer — put your agent task through the press" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wringer",
    description: "Put your agent task through the press. $1 audit, $10 real multi-agent execution.",
    images: ["/og-card.jpg"],
    creator: "@JoePro",
  },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
