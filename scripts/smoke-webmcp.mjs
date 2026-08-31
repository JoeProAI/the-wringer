import assert from "node:assert/strict";
import { createWebMcpTools } from "../lib/webmcp-tools.js";
import { hasNativeWebMcp, registerWebMcpTools } from "../lib/webmcp.js";

const calls = [];
const actions = {
  createCaseFile: async (input) => ({ ok: true, action: "case_file_created", goal: input.goal }),
  reviewCaseFile: async () => ({ ok: true, action: "case_file_reviewed" }),
  runQuickAttack: async () => ({
    ok: true,
    confirmation_required: true,
    checkout_started: false,
    charged: false,
  }),
  applyAuditRepairs: async () => ({ ok: true, action: "audit_repairs_applied" }),
  startFullCase: async ({ strategy }) => ({
    ok: true,
    strategy,
    confirmation_required: true,
    checkout_started: false,
    charged: false,
  }),
  getFullCaseStatus: async (_input, signal) => ({ ok: true, signal_received: signal instanceof AbortSignal }),
};

const tools = createWebMcpTools(actions);
const registrations = [];
const mockDocument = {
  modelContext: {
    async registerTool(tool, options) {
      registrations.push({ tool, options });
    },
  },
};

assert.equal(hasNativeWebMcp(mockDocument), true);
assert.equal(hasNativeWebMcp({}), false);
assert.deepEqual(
  tools.map(({ name }) => name),
  [
    "create_case_file",
    "review_case_file",
    "run_quick_attack",
    "apply_audit_repairs",
    "start_full_case",
    "get_full_case_status",
  ]
);

const registrationController = new AbortController();
assert.deepEqual(
  await registerWebMcpTools({ tools, documentRef: mockDocument, signal: registrationController.signal }),
  { supported: true, registered: 6 }
);
assert.equal(registrations.length, 6);
assert.ok(registrations.every(({ options }) => options.signal === registrationController.signal));

const inspectSchema = (schema) => {
  if (schema.type === "object") assert.equal(schema.additionalProperties, false);
  if (schema.properties) Object.values(schema.properties).forEach(inspectSchema);
  if (schema.items) inspectSchema(schema.items);
};
tools.forEach(({ inputSchema }) => inspectSchema(inputSchema));

const createSchema = tools[0].inputSchema;
assert.equal(createSchema.properties.goal.minLength, 1);
assert.equal(createSchema.properties.goal.maxLength, 500);
assert.deepEqual(createSchema.properties.acceptance_criteria.items.properties.kind.enum, ["AUTO", "HUMAN"]);
assert.equal(createSchema.properties.max_iterations.minimum, 5);
assert.equal(createSchema.properties.max_iterations.maximum, 100);
assert.equal(tools[4].inputSchema.properties.agents.minimum, 3);
assert.equal(tools[4].inputSchema.properties.agents.maximum, 100);
assert.deepEqual(tools[5].inputSchema, { type: "object", properties: {}, additionalProperties: false });

for (const tool of tools) {
  const input =
    tool.name === "create_case_file"
      ? { goal: "Ship a verified result", acceptance_criteria: [{ text: "Evidence exists", kind: "AUTO" }] }
      : tool.name === "start_full_case"
        ? { strategy: "triumvirate" }
        : {};
  const executionController = new AbortController();
  const output = await tool.execute(input, { signal: executionController.signal });
  assert.equal(typeof output, "string");
  const parsed = JSON.parse(output);
  assert.equal(parsed.ok, true);
  calls.push(tool.name);
}

const auditResult = JSON.parse(await tools[2].execute({}, {}));
assert.equal(auditResult.confirmation_required, true);
assert.equal(auditResult.checkout_started, false);
assert.equal(auditResult.charged, false);
const mechaResult = JSON.parse(await tools[4].execute({ strategy: "mega", agents: 24 }, {}));
assert.equal(mechaResult.confirmation_required, true);
assert.equal(mechaResult.checkout_started, false);
assert.equal(mechaResult.charged, false);
const invalidExtra = JSON.parse(await tools[1].execute({ unexpected: true }, {}));
assert.deepEqual(invalidExtra, { ok: false, error: "Invalid tool input." });
const invalidLength = JSON.parse(
  await tools[0].execute(
    { goal: "x".repeat(501), acceptance_criteria: [{ text: "Evidence exists", kind: "AUTO" }] },
    {}
  )
);
assert.deepEqual(invalidLength, { ok: false, error: "Invalid tool input." });
const invalidControl = JSON.parse(
  await tools[0].execute(
    { goal: "bad\u0000goal", acceptance_criteria: [{ text: "Evidence exists", kind: "AUTO" }] },
    {}
  )
);
assert.deepEqual(invalidControl, { ok: false, error: "Invalid tool input." });

const canceledController = new AbortController();
canceledController.abort();
const canceled = JSON.parse(await tools[5].execute({}, { signal: canceledController.signal }));
assert.deepEqual(canceled, { ok: false, canceled: true, error: "Tool execution was canceled." });

registrationController.abort();
assert.ok(registrations.every(({ options }) => options.signal.aborted));
assert.equal(calls.length, 6);
console.log("WEBMCP_SMOKE_OK 6 tools registered, schemas strict, outputs JSON, paid actions gated, cleanup verified");
