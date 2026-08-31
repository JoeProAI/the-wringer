import HomePage from "../components/HomePage";
import { buildMetadata } from "../lib/seo";
import { FAQS } from "../lib/faq";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const isShare = Boolean(params?.draft) || Boolean(params?.session_id);
  return buildMetadata({
    title: { absolute: "The Wringer | Agent-native work orders, audits, and MECHA runs" },
    description:
      "Humans and AI agents build the same checkable work orders through native WebMCP tools, then run a $1 audit or a $10 MECHA case that has to prove the result.",
    path: "/",
    noIndex: isShare,
  });
}

const FAQS_JSON = FAQS.map((f) => ({
  "@type": "Question",
  name: f.q,
  acceptedAnswer: { "@type": "Answer", text: f.a },
}));

export default function Page() {
  return (
    <>
      <HomePage />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS_JSON,
          }),
        }}
      />
    </>
  );
}
