// PostHog event helper. Safe no-op when PostHog is not initialized
// (no NEXT_PUBLIC_POSTHOG_KEY set), so the product flow never breaks
// on analytics. Once the key is set in Vercel, events flow with no
// further code changes.

import posthog from "posthog-js";

export function track(event, props = {}) {
  try {
    if (posthog?.config?.api_host && typeof posthog.capture === "function") {
      posthog.capture(event, props);
    }
  } catch {
    // analytics must never break the product flow
  }
}
