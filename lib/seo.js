// Shared SEO helpers for The Wringer (App Router).
// Canonical host is www (apex 308-redirects to www), so every absolute URL
// defaults to www. Set SITE_URL env only if you host elsewhere on purpose.

export const SITE_URL = (process.env.SITE_URL || "https://www.thewringer.ai").replace(/\/+$/, "");

export function buildMetadata({ title, description, path = "/", noIndex = false }) {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "The Wringer",
      type: "website",
      locale: "en_US",
      images: [
        {
          url: `${SITE_URL}/og-card.jpg`,
          width: 1200,
          height: 630,
          alt: "The Wringer: turn vague AI agent tasks into checkable work orders",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-card.jpg`],
      creator: "@JoePro",
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
        },
  };
}
