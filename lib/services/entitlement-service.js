import {
  AUDIT_PRICE_CENTS,
  MECHA_BASE_PRICE_CENTS,
  mechaPriceCents,
} from "../pricing.js";
import { assertPlainObject, invalidRequest } from "./http-service.js";

export const CURRENCY = "usd";

export function getEntitlement(tier, requestedAgents) {
  if (tier !== "audit" && tier !== "mecha") throw invalidRequest();
  if (tier === "audit") {
    if (requestedAgents !== undefined) throw invalidRequest();
    return {
      tier,
      agents: 0,
      amountCents: AUDIT_PRICE_CENTS,
      currency: CURRENCY,
      isMega: false,
    };
  }

  if (requestedAgents !== undefined && (!Number.isInteger(requestedAgents) || requestedAgents < 3 || requestedAgents > 100)) {
    throw invalidRequest();
  }
  const isMega = requestedAgents !== undefined && requestedAgents > 4;
  const agents = isMega ? requestedAgents : 4;
  return {
    tier,
    agents,
    amountCents: isMega ? mechaPriceCents(agents) : MECHA_BASE_PRICE_CENTS,
    currency: CURRENCY,
    isMega,
  };
}

export function parseCheckoutRequest(body) {
  const value = assertPlainObject(body, ["tier", "agents"]);
  if (typeof value.tier !== "string") throw invalidRequest();
  return getEntitlement(value.tier, value.agents);
}

export function entitlementMetadata(entitlement) {
  return {
    wringer_schema: "2",
    wringer_tier: entitlement.tier,
    wringer_agents: String(entitlement.agents),
    wringer_amount_cents: String(entitlement.amountCents),
    wringer_currency: entitlement.currency,
  };
}
