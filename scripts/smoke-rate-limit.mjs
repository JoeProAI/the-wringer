import { takeToken } from "../lib/rate-limit.js";

const key = "test:" + Math.random();
const cfg = { limit: 3, windowMs: 60_000 };
for (let i = 0; i < 3; i++) {
  const r = takeToken(key, cfg);
  if (!r.ok) {
    console.error("expected ok", i, r);
    process.exit(1);
  }
}
const blocked = takeToken(key, cfg);
if (blocked.ok || blocked.retryAfterSec < 1) {
  console.error("expected block", blocked);
  process.exit(1);
}
console.log("RATE_LIMIT_SMOKE_OK", blocked.retryAfterSec);
