const CASE_SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string", minLength: 1, maxLength: 500 },
    acceptance_criteria: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, maxLength: 300 },
          kind: { type: "string", enum: ["AUTO", "HUMAN"] },
          check: { type: "string", maxLength: 500 },
          expect: { type: "string", maxLength: 500 },
        },
        required: ["text", "kind"],
        additionalProperties: false,
      },
    },
    non_goals: { type: "string", maxLength: 1000 },
    max_iterations: { type: "integer", minimum: 5, maximum: 100 },
    preauthorized: { type: "string", maxLength: 500 },
    strategy: {
      type: "string",
      enum: ["senate", "triumvirate", "mega", "best-of-3", "solo-claude", "solo-codex", "frontier-coder"],
    },
    agents: { type: "integer", minimum: 3, maximum: 100 },
  },
  required: ["goal", "acceptance_criteria"],
  additionalProperties: false,
};

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const FULL_CASE_SCHEMA = {
  type: "object",
  properties: {
    strategy: {
      type: "string",
      enum: ["senate", "triumvirate", "mega", "best-of-3", "solo-claude", "solo-codex", "frontier-coder"],
    },
    agents: { type: "integer", minimum: 3, maximum: 100 },
  },
  required: ["strategy"],
  additionalProperties: false,
};

const STATUS_SCHEMA = EMPTY_SCHEMA;

const jsonResult = (value) => JSON.stringify(value);

const inputMatchesSchema = (schema, value) => {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if (schema.additionalProperties === false && keys.some((key) => !Object.hasOwn(schema.properties || {}, key))) return false;
    if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) return false;
    return keys.every((key) => !schema.properties?.[key] || inputMatchesSchema(schema.properties[key], value[key]));
  }
  if (schema.type === "array") {
    return Array.isArray(value) &&
      value.length >= (schema.minItems ?? 0) &&
      value.length <= (schema.maxItems ?? Number.POSITIVE_INFINITY) &&
      value.every((item) => inputMatchesSchema(schema.items, item));
  }
  if (schema.type === "string") {
    return typeof value === "string" &&
      !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) &&
      value.length >= (schema.minLength ?? 0) &&
      value.length <= (schema.maxLength ?? Number.POSITIVE_INFINITY) &&
      (!schema.enum || schema.enum.includes(value));
  }
  if (schema.type === "integer") {
    return Number.isInteger(value) &&
      value >= (schema.minimum ?? Number.NEGATIVE_INFINITY) &&
      value <= (schema.maximum ?? Number.POSITIVE_INFINITY);
  }
  return false;
};

const executable = (execute, inputSchema) => async (input = {}, context = {}) => {
  try {
    if (context.signal?.aborted) {
      return jsonResult({ ok: false, canceled: true, error: "Tool execution was canceled." });
    }
    if (!inputMatchesSchema(inputSchema, input)) {
      return jsonResult({ ok: false, error: "Invalid tool input." });
    }
    return jsonResult(await execute(input, context.signal));
  } catch (error) {
    if (error?.name === "AbortError" || context.signal?.aborted) {
      return jsonResult({ ok: false, canceled: true, error: "Tool execution was canceled." });
    }
    return jsonResult({ ok: false, error: error?.message || "Tool execution failed." });
  }
};

export const createWebMcpTools = (actions) => [
  {
    name: "create_case_file",
    title: "Create case file",
    description: "Create or replace the visible Wringer work order from a goal, verification criteria, boundaries, and run settings. This only edits and saves the draft; it never starts a paid action.",
    inputSchema: CASE_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: executable(actions.createCaseFile, CASE_SCHEMA),
  },
  {
    name: "review_case_file",
    title: "Review case file",
    description: "Review the current visible work order and compile its case contract without starting an audit, checkout, or full run.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: executable(actions.reviewCaseFile, EMPTY_SCHEMA),
  },
  {
    name: "run_quick_attack",
    title: "Stage Quick Attack",
    description: "Stage the paid $1 Audit for the current work order. This never charges, creates checkout, redirects, or submits payment. The user must confirm with the visible WebMCP confirmation card.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: false },
    execute: executable(actions.runQuickAttack, EMPTY_SCHEMA),
  },
  {
    name: "apply_audit_repairs",
    title: "Apply audit repairs",
    description: "Apply the currently visible auditor-proposed repairs to the work order. Fails safely when no audit repairs are available.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: executable(actions.applyAuditRepairs, EMPTY_SCHEMA),
  },
  {
    name: "start_full_case",
    title: "Stage Full Case",
    description: "Stage a paid MECHA full case with the selected strategy and agent count. This never charges, creates checkout, redirects, or submits payment. The user must confirm with the visible WebMCP confirmation card.",
    inputSchema: FULL_CASE_SCHEMA,
    annotations: { readOnlyHint: false },
    execute: executable(actions.startFullCase, FULL_CASE_SCHEMA),
  },
  {
    name: "get_full_case_status",
    title: "Read Full Case status",
    description: "Read the current visible MECHA full-case progress and final result without making a network request or triggering a side effect.",
    inputSchema: STATUS_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: executable(actions.getFullCaseStatus, STATUS_SCHEMA),
  },
];
