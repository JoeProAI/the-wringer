import { search, SafeSearchType } from "duck-duck-scrape";

// Lightweight web-search tool used by the OpenClaw (tool-calling) persona.
// Hermes uses xAI's native server-side web/X search instead, so it never
// touches this.
export async function webSearch(query, maxResults = 5) {
  try {
    const results = await search(query, { safeSearch: SafeSearchType.MODERATE });
    return (results.results || []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  } catch (err) {
    console.error("[tools] web search failed:", err?.message || err);
    return [];
  }
}

export const OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Use when you need up-to-date facts, news, or to verify a claim.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

export async function executeTool(name, args) {
  if (name === "web_search") {
    const results = await webSearch(String(args?.query || ""));
    if (!results.length) return "No search results found.";
    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
      .join("\n\n");
  }
  return `Unknown tool: ${name}`;
}
