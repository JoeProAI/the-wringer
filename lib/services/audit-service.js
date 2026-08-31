import { getSiteUrl, isFreeMode, requireEnv } from "./config-service.js";
import { parseCaseRequest } from "./case-service.js";
import { ServiceError } from "./http-service.js";
import { verifyAndConsume } from "../verify-payment.js";

const RUN_INSTRUCTION = `THE WRINGER. You are The Wringer: a merciless protocol auditor and dry-run executor.
1. Emit the acknowledged <contract> (repair any malformed ACs and say what you fixed).
2. Audit it: flag every AC that is not mechanically checkable, every missing budget, every safety gap, every ambiguity that would force NEEDS_HUMAN.
3. Simulate up to 5 iterations of the loop as a DRY RUN (no real tools - mark all observations as SIMULATED), following the iteration skeleton exactly.
4. End with:
<verdict>
  grade: S | A | B | C | F
  predicted_exit: <code + name>
  weakest_link: <one sentence>
  one_fix: <the single highest-leverage improvement to the contract>
</verdict>
5. After the verdict, emit ONE fenced JSON block the UI can apply back into the form. Use the repaired contract (not the weak original):
\`\`\`json
{
  "repaired_form": {
    "goal": "one sentence finished state",
    "acs": [
      {"text": "plain pass/fail check", "kind": "AUTO|HUMAN", "check": "optional how", "expect": "optional signal"}
    ],
    "nonGoals": "boundaries",
    "maxIterations": 30,
    "preauthorized": ""
  }
}
\`\`\`
No commentary inside the JSON fence. Be brutal but fair. Keep total output under 1400 words.`;

export async function runAudit(body, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const freeMode = isFreeMode(env);
  const { sessionId, prompt } = parseCaseRequest(body, { sessionOptional: freeMode });
  let payment = null;
  if (!freeMode) {
    payment = await (dependencies.verifyAndConsume ?? verifyAndConsume)(sessionId, "audit", {
      env,
      ...dependencies.paymentDependencies,
      allowLegacy: dependencies.sessionSource === "body",
      requireLegacy: dependencies.sessionSource === "body",
    });
    if (payment.replay) {
      if (payment.replay.kind !== "audit") {
        throw new ServiceError("LEDGER_UNAVAILABLE", 503, "Payment ledger is unavailable.");
      }
      return { output: payment.replay.output, model: payment.replay.model };
    }
  }

  const apiKey = requireEnv("OPENROUTER_API_KEY", env);
  const model = env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getSiteUrl(env),
        "X-Title": "The Wringer",
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: RUN_INSTRUCTION },
        ],
      }),
    });
  } catch {
    throw new ServiceError("AUDIT_UNAVAILABLE", 502, "Audit service is unavailable.");
  }
  if (!response.ok) {
    throw new ServiceError("AUDIT_UNAVAILABLE", 502, "Audit service is unavailable.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ServiceError("AUDIT_UNAVAILABLE", 502, "Audit service is unavailable.");
  }
  const output = data?.choices?.[0]?.message?.content;
  if (typeof output !== "string") {
    throw new ServiceError("AUDIT_UNAVAILABLE", 502, "Audit service is unavailable.");
  }
  if (payment) {
    await payment.ledger.completeAudit(payment.claim, { output, model });
  }
  return { output, model };
}
