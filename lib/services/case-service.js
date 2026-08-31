import { buildPrompt } from "../protocol.js";
import { MECHA_STRATEGIES } from "../mecha-runner.js";
import {
  assertPlainObject,
  boundedString,
  invalidRequest,
} from "./http-service.js";

export const MAX_COMPILED_CASE_CHARS = 20_000;
const FORM_KEYS = [
  "goal",
  "acs",
  "nonGoals",
  "maxIterations",
  "preauthorized",
  "mechaStrategy",
  "mechaAgents",
];
const AC_KEYS = ["text", "kind", "check", "expect"];

export function normalizeCase(form) {
  assertPlainObject(form, FORM_KEYS);
  const goal = boundedString(form.goal, { min: 1, max: 4_000 });
  if (!Array.isArray(form.acs) || form.acs.length > 20) throw invalidRequest();
  const acs = form.acs.map((raw) => {
    const ac = assertPlainObject(raw, AC_KEYS);
    if (ac.kind !== "AUTO" && ac.kind !== "HUMAN") throw invalidRequest();
    return {
      text: boundedString(ac.text, { min: 1, max: 2_000 }),
      kind: ac.kind,
      check: boundedString(ac.check, { max: 2_000, optional: true }),
      expect: boundedString(ac.expect, { max: 2_000, optional: true }),
    };
  });
  if (!Number.isInteger(form.maxIterations) || form.maxIterations < 5 || form.maxIterations > 100) {
    throw invalidRequest();
  }
  const mechaStrategy = form.mechaStrategy ?? "triumvirate";
  if (typeof mechaStrategy !== "string" || !MECHA_STRATEGIES.includes(mechaStrategy)) {
    throw invalidRequest();
  }
  const mechaAgents = form.mechaAgents ?? 24;
  if (!Number.isInteger(mechaAgents) || mechaAgents < 3 || mechaAgents > 100) {
    throw invalidRequest();
  }

  return {
    goal,
    acs,
    nonGoals: boundedString(form.nonGoals, { max: 4_000, optional: true }),
    maxIterations: form.maxIterations,
    preauthorized: boundedString(form.preauthorized, { max: 4_000, optional: true }),
    mechaStrategy,
    mechaAgents,
  };
}

export function compileCase(form) {
  const normalized = normalizeCase(form);
  const prompt = buildPrompt(normalized);
  if (prompt.length > MAX_COMPILED_CASE_CHARS) throw invalidRequest();
  return { form: normalized, prompt };
}

export function parseCaseRequest(body, { sessionOptional = false } = {}) {
  const value = assertPlainObject(body, ["sessionId", "form"]);
  return {
    sessionId: parseSessionId(value.sessionId, { optional: sessionOptional }),
    ...compileCase(value.form),
  };
}

export function parseSessionId(value, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  const sessionId = boundedString(value, { min: 8, max: 255 });
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw invalidRequest();
  return sessionId;
}
