const DRAFT_KEY = "wringer_draft_v1";
const FORM_KEY = "wringer_form"; // legacy checkout key

export function emptyAc() {
  return { text: "", kind: "AUTO", check: "", expect: "" };
}

export function normalizeForm(raw = {}) {
  const acs = Array.isArray(raw.acs)
    ? raw.acs
        .map((a) => ({
          text: String(a?.text || "").trim(),
          kind: a?.kind === "HUMAN" ? "HUMAN" : "AUTO",
          check: String(a?.check || "").trim(),
          expect: String(a?.expect || "").trim(),
        }))
        .filter((a) => a.text)
    : [];
  return {
    goal: String(raw.goal || "").trim(),
    acs: acs.length ? acs : [emptyAc()],
    nonGoals: String(raw.nonGoals || "").trim(),
    maxIterations: Math.max(5, Math.min(100, Number(raw.maxIterations) || 30)),
    preauthorized: String(raw.preauthorized || "").trim(),
    mechaStrategy: String(raw.mechaStrategy || "triumvirate"),
    mechaAgents: Math.max(3, Math.min(100, Number(raw.mechaAgents) || 24)),
  };
}

export function formHasContent(form) {
  const f = normalizeForm(form);
  return Boolean(f.goal || f.nonGoals || f.preauthorized || f.acs.some((a) => a.text));
}

export function saveDraftLocal(form) {
  if (typeof window === "undefined") return;
  const payload = {
    savedAt: Date.now(),
    form: normalizeForm(form),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  // keep checkout restore key in sync
  localStorage.setItem(FORM_KEY, JSON.stringify(payload.form));
  return payload;
}

export function loadDraftLocal() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY) || localStorage.getItem(FORM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const form = normalizeForm(parsed.form || parsed);
    if (!formHasContent(form)) return null;
    return {
      savedAt: parsed.savedAt || null,
      form,
    };
  } catch {
    return null;
  }
}

export function clearDraftLocal() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
  // leave wringer_form alone during active checkout flows unless explicit clear
  localStorage.removeItem(FORM_KEY);
}

function toBase64Url(str) {
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const full = b64 + pad;
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(full)));
  }
  return Buffer.from(full, "base64").toString("utf8");
}

export function encodeDraftParam(form) {
  const slim = normalizeForm(form);
  // keep URL short: drop empty optional fields
  const compact = {
    g: slim.goal,
    a: slim.acs.map((x) => ({
      t: x.text,
      k: x.kind === "HUMAN" ? "H" : "A",
      ...(x.check ? { c: x.check } : {}),
      ...(x.expect ? { e: x.expect } : {}),
    })),
    n: slim.nonGoals || undefined,
    i: slim.maxIterations !== 30 ? slim.maxIterations : undefined,
    p: slim.preauthorized || undefined,
    s: slim.mechaStrategy !== "triumvirate" ? slim.mechaStrategy : undefined,
    m: slim.mechaAgents !== 24 ? slim.mechaAgents : undefined,
  };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeDraftParam(param) {
  if (!param) return null;
  try {
    const compact = JSON.parse(fromBase64Url(param));
    return normalizeForm({
      goal: compact.g || compact.goal || "",
      acs: (compact.a || compact.acs || []).map((x) => ({
        text: x.t || x.text || "",
        kind: x.k === "H" || x.kind === "HUMAN" ? "HUMAN" : "AUTO",
        check: x.c || x.check || "",
        expect: x.e || x.expect || "",
      })),
      nonGoals: compact.n || compact.nonGoals || "",
      maxIterations: compact.i || compact.maxIterations || 30,
      preauthorized: compact.p || compact.preauthorized || "",
      mechaStrategy: compact.s || compact.mechaStrategy || "triumvirate",
      mechaAgents: compact.m || compact.mechaAgents || 24,
    });
  } catch {
    return null;
  }
}

export function buildDraftShareUrl(form, origin) {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "https://www.thewringer.ai")).replace(
    /\/$/,
    ""
  );
  return `${base}/?draft=${encodeDraftParam(form)}`;
}
