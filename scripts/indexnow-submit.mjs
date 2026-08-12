// IndexNow submission for Bing/Yandex/Seznam discovery.
// No secrets: the key is public by design (it lives at the site root as
// https://www.thewringer.ai/<KEY>.txt and is verified by the IndexNow API).
// Run after a deploy:  node scripts/indexnow-submit.mjs
// Fail exit code on any non-2xx response.

const HOST = "www.thewringer.ai";
const KEY = "4e58cca9e44efd6877a80ab602f12060";

const URLS = [
  "https://www.thewringer.ai/",
  "https://www.thewringer.ai/audit",
  "https://www.thewringer.ai/mecha",
  "https://www.thewringer.ai/templates",
  "https://www.thewringer.ai/guides",
  "https://www.thewringer.ai/guides/acceptance-criteria-for-ai-agents",
  "https://www.thewringer.ai/guides/why-ai-agents-need-a-dry-run",
];

const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

async function submit(endpoint) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: URLS,
      }),
    });
    const text = await res.text();
    console.log(`${endpoint} -> ${res.status} ${text.trim().slice(0, 160)}`);
    if (!res.ok) process.exitCode = 1;
  } catch (e) {
    console.error(`${endpoint} -> ERROR ${e.message}`);
    process.exitCode = 1;
  }
}

for (const ep of ENDPOINTS) await submit(ep);
