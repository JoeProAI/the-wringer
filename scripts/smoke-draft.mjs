import { encodeDraftParam, decodeDraftParam, normalizeForm, formHasContent } from "../lib/draft.js";
import { extractRepairedForm } from "../lib/parse-audit.js";

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

console.log("SMOKE_OK");
