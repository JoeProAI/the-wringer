// Smoke tests for MECHA email delivery logic.
// Tests the email module's behavior under various conditions without hitting
// live Resend or Stripe APIs.

import { sendMechaDeliverable } from "../lib/email.js";

// Store original env vars and mock them
const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

// Mock report for testing
const mockReport = {
  exit_code: 0,
  exit_name: "SUCCESS",
  strategy: "triumvirate",
  cost_usd: 0.1923,
  elapsed_s: 312.4,
  run_id: "test-run-123",
  winner: 1,
  confidence: 0.9,
  candidates: [
    { name: "claude", backend: "openrouter", text: "Test answer", cost_usd: 0.05 },
    { name: "codex", backend: "openrouter", text: "Another answer", cost_usd: 0.04 },
  ],
  reviewer: { name: "reviewer", text: "Claude wins", cost_usd: 0.02 },
  gamma: "# GAMMA REPORT\n\nTest report content here.",
  gamma_presentation_url: "https://gamma.app/example",
  gamma_export_url: "https://gamma.app/export/example.pdf",
};

// Test 1: Email skipped when RESEND_API_KEY is missing
async function testSkipWhenNoKey() {
  resetEnv();
  delete process.env.RESEND_API_KEY;
  
  const result = await sendMechaDeliverable({
    report: mockReport,
    sessionId: "cs_test_123",
    runId: "test-run",
  });
  
  if (result.sent !== false) {
    throw new Error(`testSkipWhenNoKey: expected sent=false, got ${result.sent}`);
  }
  if (!result.reason?.includes("RESEND_API_KEY")) {
    throw new Error(`testSkipWhenNoKey: expected reason about RESEND_API_KEY, got ${result.reason}`);
  }
  console.log("PASS: testSkipWhenNoKey");
}

// Test 2: Email skipped when no session ID (unpaid/free mode)
async function testSkipWhenNoSession() {
  resetEnv();
  process.env.RESEND_API_KEY = "re_test_fake";
  
  const result = await sendMechaDeliverable({
    report: mockReport,
    sessionId: null,
    runId: "test-run",
  });
  
  if (result.sent !== false) {
    throw new Error(`testSkipWhenNoSession: expected sent=false, got ${result.sent}`);
  }
  if (!result.reason?.toLowerCase().includes("session")) {
    throw new Error(`testSkipWhenNoSession: expected reason about session, got ${result.reason}`);
  }
  console.log("PASS: testSkipWhenNoSession");
}

// Test 3: Email skipped when report is missing/malformed
async function testSkipWhenNoReport() {
  resetEnv();
  process.env.RESEND_API_KEY = "re_test_fake";
  
  const result1 = await sendMechaDeliverable({
    report: null,
    sessionId: "cs_test_123",
    runId: "test-run",
  });
  
  if (result1.sent !== false) {
    throw new Error(`testSkipWhenNoReport (null): expected sent=false, got ${result1.sent}`);
  }
  
  const result2 = await sendMechaDeliverable({
    report: "not an object",
    sessionId: "cs_test_123",
    runId: "test-run",
  });
  
  if (result2.sent !== false) {
    throw new Error(`testSkipWhenNoReport (string): expected sent=false, got ${result2.sent}`);
  }
  console.log("PASS: testSkipWhenNoReport");
}

// Test 4: Email skipped when Stripe session cannot retrieve email
// (This will fail to get email because STRIPE_SECRET_KEY is not set or session is invalid)
async function testSkipWhenNoEmail() {
  resetEnv();
  process.env.RESEND_API_KEY = "re_test_fake";
  // Don't set STRIPE_SECRET_KEY, so getSessionEmail returns null
  
  const result = await sendMechaDeliverable({
    report: mockReport,
    sessionId: "cs_test_invalid",
    runId: "test-run",
  });
  
  if (result.sent !== false) {
    throw new Error(`testSkipWhenNoEmail: expected sent=false, got ${result.sent}`);
  }
  if (!result.reason?.toLowerCase().includes("email")) {
    throw new Error(`testSkipWhenNoEmail: expected reason about email, got ${result.reason}`);
  }
  console.log("PASS: testSkipWhenNoEmail");
}

// Test 5: Empty report doesn't crash
async function testEmptyReportNoCrash() {
  resetEnv();
  process.env.RESEND_API_KEY = "re_test_fake";
  
  const result = await sendMechaDeliverable({
    report: {},
    sessionId: "cs_test_123",
    runId: "test-run",
  });
  
  // Should not throw, should return sent=false due to no email retrieval
  if (typeof result !== "object") {
    throw new Error(`testEmptyReportNoCrash: expected object result, got ${typeof result}`);
  }
  console.log("PASS: testEmptyReportNoCrash");
}

// Test 6: Report with missing gamma/presentation still works
async function testPartialReportNoCrash() {
  resetEnv();
  process.env.RESEND_API_KEY = "re_test_fake";
  
  const partialReport = {
    exit_code: 1,
    exit_name: "PARTIAL",
    strategy: "solo-claude",
    cost_usd: 0.05,
    run_id: "partial-run",
    // No gamma, no presentation URLs
  };
  
  const result = await sendMechaDeliverable({
    report: partialReport,
    sessionId: "cs_test_123",
    runId: "partial-run",
  });
  
  // Should not throw
  if (typeof result !== "object") {
    throw new Error(`testPartialReportNoCrash: expected object result, got ${typeof result}`);
  }
  console.log("PASS: testPartialReportNoCrash");
}

// Run all tests
async function runTests() {
  try {
    await testSkipWhenNoKey();
    await testSkipWhenNoSession();
    await testSkipWhenNoReport();
    await testSkipWhenNoEmail();
    await testEmptyReportNoCrash();
    await testPartialReportNoCrash();
    
    console.log("\nEMAIL_SMOKE_OK - All email tests passed");
    resetEnv();
  } catch (e) {
    console.error("\nEMAIL_SMOKE_FAIL:", e.message);
    resetEnv();
    process.exit(1);
  }
}

runTests();
