import { encodeDraftParam, decodeDraftParam, normalizeForm, formHasContent } from "../lib/draft.js";
import { extractRepairedForm } from "../lib/parse-audit.js";
import { VERIFIED_CASES } from "../lib/verified-cases.js";

const form = normalizeForm({
  goal: "Customers can reset passwords",
  acs: [{ text: "Email arrives", kind: "HUMAN" }],
  maxIterations: 25,
});
const back = decodeDraftParam(encodeDraftParam(form));
if (!(back.goal === form.goal && back.maxIterations === 25 && formHasContent(form))) {
  console.error("draft_roundtrip failed", back);
  process.exit(1);
}

// Test verified case draft roundtrips
for (const c of VERIFIED_CASES) {
  const encoded = encodeDraftParam(c.form);
  const decoded = decodeDraftParam(encoded);
  if (!decoded) {
    console.error(`verified_case_decode failed: ${c.id} returned null`);
    process.exit(1);
  }
  if (decoded.goal !== c.form.goal) {
    console.error(`verified_case_goal mismatch: ${c.id}`, { expected: c.form.goal, got: decoded.goal });
    process.exit(1);
  }
  if (!formHasContent(decoded)) {
    console.error(`verified_case_content empty: ${c.id}`);
    process.exit(1);
  }
  if (!Array.isArray(decoded.acs) || decoded.acs.length !== c.form.acs.length) {
    console.error(`verified_case_acs mismatch: ${c.id}`, { expected: c.form.acs.length, got: decoded.acs?.length });
    process.exit(1);
  }
  // Verify each case has citations
  if (!c.evidence?.citations?.length) {
    console.error(`verified_case_citations missing: ${c.id}`);
    process.exit(1);
  }
}

const sample = [
  "<contract><goal>G</goal></contract>",
  "```json",
  JSON.stringify({
    repaired_form: {
      goal: "Fixed goal",
      acs: [{ text: "A", kind: "AUTO" }],
      nonGoals: "x",
      maxIterations: 22,
      preauthorized: "",
    },
  }),
  "```",
].join("\n");

const repaired = extractRepairedForm(sample);
if (!(repaired && repaired.goal === "Fixed goal" && repaired.maxIterations === 22)) {
  console.error("parse failed", repaired);
  process.exit(1);
}

// Edge case tests: malformed/empty/boundary draft payloads
const edgeCases = [
  { name: "empty_string", input: "", expectNull: true },
  { name: "null_input", input: null, expectNull: true },
  { name: "undefined_input", input: undefined, expectNull: true },
  { name: "invalid_base64", input: "!!!notbase64!!!", expectNull: true },
  { name: "valid_but_empty_goal", input: encodeDraftParam({ goal: "", acs: [] }), expectNull: false },
  { name: "boundary_max_iterations_low", input: encodeDraftParam({ goal: "Test", maxIterations: 1 }), expectNull: false, checkIterations: 5 },
  { name: "boundary_max_iterations_high", input: encodeDraftParam({ goal: "Test", maxIterations: 200 }), expectNull: false, checkIterations: 100 },
];

for (const tc of edgeCases) {
  const result = decodeDraftParam(tc.input);
  if (tc.expectNull && result !== null) {
    console.error(`edge_case_${tc.name}: expected null, got`, result);
    process.exit(1);
  }
  if (!tc.expectNull && result === null) {
    console.error(`edge_case_${tc.name}: expected non-null, got null`);
    process.exit(1);
  }
  if (tc.checkIterations !== undefined && result?.maxIterations !== tc.checkIterations) {
    console.error(`edge_case_${tc.name}: maxIterations expected ${tc.checkIterations}, got ${result?.maxIterations}`);
    process.exit(1);
  }
}

// Verify bad draft ID does not crash but returns null
const badDraftIds = ["abc123", "eyJnIjoiIn0", "e30"]; // malformed or empty JSON
for (const bad of badDraftIds) {
  try {
    const result = decodeDraftParam(bad);
    // Should either return null or a normalized empty form, not crash
    if (result && !result.goal && result.acs?.length === 1 && !result.acs[0]?.text) {
      // Acceptable: empty form
    } else if (result === null) {
      // Acceptable: null
    } else if (result && formHasContent(result)) {
      console.error(`bad_draft_id_${bad}: unexpectedly has content`, result);
      process.exit(1);
    }
  } catch (e) {
    console.error(`bad_draft_id_${bad}: threw exception`, e.message);
    process.exit(1);
  }
}

console.log("SMOKE_OK");
