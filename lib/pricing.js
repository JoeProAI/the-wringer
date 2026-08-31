export const AUDIT_PRICE_CENTS = 100;
export const MECHA_BASE_PRICE_CENTS = 1000;
export const MECHA_AGENT_PRICE_CENTS = 35;
export const MECHA_PRICE_CAP_CENTS = 4000;

export function mechaPriceCents(agents) {
  const count = Math.max(3, Math.min(100, Number(agents) || 0));
  if (count <= 4) return MECHA_BASE_PRICE_CENTS;
  return Math.min(
    MECHA_BASE_PRICE_CENTS + MECHA_AGENT_PRICE_CENTS * (count - 4),
    MECHA_PRICE_CAP_CENTS
  );
}
