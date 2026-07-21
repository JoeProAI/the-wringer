import { normalizeForm, emptyAc } from "./draft";

/**
 * Pull a repaired work order out of The Wringer audit text.
 * Prefers a trailing ```json repaired_form block, then falls back to <contract> XML.
 */
export function extractRepairedForm(auditText) {
  if (!auditText || typeof auditText !== "string") return null;

  const fromJson = parseRepairedJson(auditText);
  if (fromJson) return fromJson;

  const fromXml = parseContractXml(auditText);
  if (fromXml) return fromXml;

  return null;
}

function parseRepairedJson(text) {
  // ```json ... ``` with repaired_form / form
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const m of fences) {
    const body = m[1].trim();
    try {
      const obj = JSON.parse(body);
      const form = obj.repaired_form || obj.form || obj.work_order || obj;
      const normalized = coerceForm(form);
      if (normalized) return normalized;
    } catch {
      // keep looking
    }
  }

  // bare JSON object containing "goal" + "acs"
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start && end - start < 12000) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      const form = obj.repaired_form || obj.form || obj;
      const normalized = coerceForm(form);
      if (normalized) return normalized;
    } catch {
      // ignore
    }
  }
  return null;
}

function coerceForm(form) {
  if (!form || typeof form !== "object") return null;
  const goal = String(form.goal || "").trim();
  if (!goal) return null;
  const acsIn = Array.isArray(form.acs)
    ? form.acs
    : Array.isArray(form.acceptance_criteria)
      ? form.acceptance_criteria
      : [];
  const acs = acsIn
    .map((a) => {
      if (typeof a === "string") return { text: a.trim(), kind: "AUTO", check: "", expect: "" };
      return {
        text: String(a.text || a.description || a.expect || "").trim(),
        kind: String(a.kind || "").toUpperCase() === "HUMAN" ? "HUMAN" : "AUTO",
        check: String(a.check || "").trim(),
        expect: String(a.expect || "").trim(),
      };
    })
    .filter((a) => a.text);
  return normalizeForm({
    goal,
    acs: acs.length ? acs : [emptyAc()],
    nonGoals: form.nonGoals || form.non_goals || "",
    maxIterations: form.maxIterations || form.max_iterations || 30,
    preauthorized: form.preauthorized || "",
  });
}

function parseContractXml(text) {
  const match = text.match(/<contract\b[\s\S]*?<\/contract>/i);
  if (!match) return null;
  const xml = match[0];

  const goal = pickTag(xml, "goal");
  if (!goal) return null;

  const nonGoals = pickTag(xml, "non_goals") || pickTag(xml, "non-goals") || "";
  const preauthorized = pickTag(xml, "preauthorized") || "";

  let maxIterations = 30;
  const budget = xml.match(/<budget\b([^>]*)\/?>/i);
  if (budget) {
    const mi = budget[1].match(/max_iterations\s*=\s*"(\d+)"/i);
    if (mi) maxIterations = parseInt(mi[1], 10);
  }

  const acs = [];
  const acRe = /<ac\b([^>]*)\/?>(?:([^<]*)<\/ac>)?/gi;
  let m;
  while ((m = acRe.exec(xml))) {
    const attrs = m[1] || "";
    const kind = (attrs.match(/\bkind\s*=\s*"([^"]+)"/i)?.[1] || "AUTO").toUpperCase() === "HUMAN" ? "HUMAN" : "AUTO";
    const check = attrs.match(/\bcheck\s*=\s*"([^"]*)"/i)?.[1] || "";
    const expect = attrs.match(/\bexpect\s*=\s*"([^"]*)"/i)?.[1] || "";
    // comment after tag: <!-- text -->
    const after = xml.slice(m.index, m.index + m[0].length + 200);
    const comment = after.match(/<!--\s*([\s\S]*?)\s*-->/)?.[1]?.trim() || "";
    const text = decodeXml(comment || expect || check || m[2] || "").trim();
    if (text) {
      acs.push({
        text,
        kind,
        check: decodeXml(check),
        expect: decodeXml(expect),
      });
    }
  }

  return normalizeForm({
    goal: decodeXml(goal),
    acs: acs.length ? acs : [emptyAc()],
    nonGoals: decodeXml(nonGoals).replace(/^None specified\.?$/i, ""),
    maxIterations,
    preauthorized: decodeXml(preauthorized).replace(/^Empty\..*$/i, ""),
  });
}

function pickTag(xml, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function decodeXml(s) {
  return String(s || "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
