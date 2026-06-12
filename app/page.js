"use client";

import { useEffect, useState, useCallback } from "react";
import { buildContract, buildPrompt } from "../lib/protocol";

const EMPTY_AC = { text: "", kind: "AUTO", check: "", expect: "" };

export default function Home() {
  const [goal, setGoal] = useState("");
  const [acs, setAcs] = useState([{ ...EMPTY_AC }]);
  const [nonGoals, setNonGoals] = useState("");
  const [maxIterations, setMaxIterations] = useState(30);
  const [preauthorized, setPreauthorized] = useState("");
  const [contract, setContract] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [mechaModel, setMechaModel] = useState("x-ai/grok-4.3");
  const [mechaProgress, setMechaProgress] = useState([]);
  const [mechaReport, setMechaReport] = useState(null);

  const formState = useCallback(
    () => ({ goal, acs, nonGoals, maxIterations, preauthorized, mechaModel }),
    [goal, acs, nonGoals, maxIterations, preauthorized, mechaModel]
  );

  const runWithSession = useCallback(async (sessionId, form) => {
    setRunning(true);
    setError("");
    setStatus("IN THE WRINGER — running your contract through the loop...");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setOutput(data.output);
      setStatus(`RUN COMPLETE — model: ${data.model}`);
    } catch (e) {
      setError(e.message);
      setStatus("");
    } finally {
      setRunning(false);
    }
  }, []);

  const pollMecha = useCallback(async (runId, sessionId) => {
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch("/api/mecha/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, sessionId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status failed");
        setMechaProgress(data.progress || []);
        if (data.done && data.report) {
          setMechaReport(data.report);
          setStatus(`MECHA RUN COMPLETE — exit ${data.report.exit_code} ${data.report.exit_name} · ${data.report.iterations} iterations · $${data.report.cost_usd} model cost`);
          setRunning(false);
          return;
        }
      } catch (e) {
        // transient poll errors are fine; keep going
      }
    }
    setError("MECHA RUN timed out after 20 minutes of polling. The sandbox may still be working.");
    setRunning(false);
  }, []);

  const startMecha = useCallback(async (sessionId, form) => {
    setRunning(true);
    setError("");
    setMechaReport(null);
    setMechaProgress([]);
    setStatus("MECHA RUN — provisioning sandbox...");
    try {
      const res = await fetch("/api/mecha/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "MECHA start failed");
      setStatus(`MECHA RUN LIVE — ${data.model} executing in sandbox. This takes minutes, not seconds.`);
      pollMecha(data.runId, sessionId);
    } catch (e) {
      setError(e.message);
      setStatus("");
      setRunning(false);
    }
  }, [pollMecha]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const tier = params.get("tier");
    if (params.get("canceled")) setStatus("Payment canceled. The Wringer waits.");
    if (sessionId) {
      const saved = localStorage.getItem("wringer_form");
      if (saved) {
        const form = JSON.parse(saved);
        setGoal(form.goal || "");
        setAcs(form.acs && form.acs.length ? form.acs : [{ ...EMPTY_AC }]);
        setNonGoals(form.nonGoals || "");
        setMaxIterations(form.maxIterations || 30);
        setPreauthorized(form.preauthorized || "");
        if (form.mechaModel) setMechaModel(form.mechaModel);
        window.history.replaceState({}, "", "/");
        if (tier === "mecha") startMecha(sessionId, form);
        else runWithSession(sessionId, form);
      }
    }
  }, [runWithSession, startMecha]);

  function compile() {
    setError("");
    if (!goal.trim()) return setError("Goal is required. The Wringer refuses vague missions.");
    setContract(buildContract(formState()));
  }

  async function wringerRun(tier) {
    setError("");
    if (!goal.trim()) return setError("Goal is required. The Wringer refuses vague missions.");
    const form = formState();
    localStorage.setItem("wringer_form", JSON.stringify(form));
    setRunning(true);
    setStatus("Opening payment gate...");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.free) {
        if (tier === "mecha") await startMecha(null, form);
        else await runWithSession(null, form);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setStatus("");
      setRunning(false);
    }
  }

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setStatus(`${label} copied to clipboard.`);
  }

  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "I just put my agent task through The Wringer (Loop Protocol v5.0). It auto-repaired my acceptance criteria and graded the whole contract. Brutal."
  )}&url=${encodeURIComponent("https://the-wringer.vercel.app")}`;

  return (
    <main className="wrap">
      <h1>THE WRINGER</h1>
      <p className="sub">
        Write down what you actually want your agent to do. The Wringer compiles it into LOOP PROTOCOL v5.0,
        audits it, dry-runs it, and grades it — before you burn real agent hours on a vague spec.
        Honest failure outranks fabricated success. Always.
      </p>

      <div className="panel">
        <h2>// Your Contract</h2>
        <label>Goal (one sentence — what must be true when the agent stops)</label>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ship a working /healthz endpoint that returns 200 with build SHA" />

        <label>Acceptance Criteria (each must be mechanically checkable)</label>
        {acs.map((ac, i) => (
          <div className="ac-row" key={i}>
            <select value={ac.kind} onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, kind: e.target.value } : a)))}>
              <option value="AUTO">AUTO</option>
              <option value="HUMAN">HUMAN</option>
            </select>
            <input value={ac.text} placeholder={`AC-${i + 1}: e.g. curl /healthz returns 200 and body contains the git SHA`} onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, text: e.target.value } : a)))} />
            <button className="btn-ghost" onClick={() => setAcs(acs.filter((_, j) => j !== i))} disabled={acs.length === 1}>✕</button>
          </div>
        ))}
        <button className="btn-ghost" onClick={() => setAcs([...acs, { ...EMPTY_AC }])}>+ ADD CRITERION</button>

        <label>Non-goals (explicitly out of scope)</label>
        <input value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} placeholder="No refactors, no dependency upgrades, no prod deploys" />

        <label>Max iterations</label>
        <input type="number" min="5" max="100" value={maxIterations} onChange={(e) => setMaxIterations(parseInt(e.target.value || "30", 10))} />

        <label>Preauthorized irreversible / outward actions (verbatim, or leave empty)</label>
        <input value={preauthorized} onChange={(e) => setPreauthorized(e.target.value)} placeholder='e.g. "git push origin feature-branch"' />

        <div className="row">
          <button className="btn-ghost" onClick={compile}>COMPILE CONTRACT</button>
          {contract && <button className="btn-ghost" onClick={() => copy(buildPrompt(formState()), "Full protocol prompt")}>COPY FULL PROMPT</button>}
        </div>

        <button className="btn-run" onClick={() => wringerRun("audit")} disabled={running}>
          {running ? <span className="blink">▮▮ IN THE WRINGER ▮▮</span> : "PUT IT THROUGH THE WRINGER — $1"}
        </button>

        <label style={{ marginTop: "18px" }}>MECHA RUN model</label>
        <select value={mechaModel} onChange={(e) => setMechaModel(e.target.value)}>
          <option value="x-ai/grok-4.3">xAI grok-4.3</option>
          <option value="anthropic/claude-sonnet-4.5">Claude sonnet-4.5</option>
          <option value="openai/gpt-5.3-codex">OpenAI gpt-5.3-codex</option>
        </select>
        <button className="btn-run" onClick={() => wringerRun("mecha")} disabled={running}>
          {running ? <span className="blink">▮▮ MECHA ENGAGED ▮▮</span> : "MECHA RUN — REAL EXECUTION — $10"}
        </button>
        <div className="sub" style={{ fontSize: "12px", marginTop: "6px" }}>
          MECHA RUN actually executes your contract: a real agent with shell access in an isolated sandbox,
          governed by the protocol harness — iteration caps, banned-repeat detection, hard cost ceiling.
          Returns the final report + exit code. No fabricated SUCCESS.
        </div>
        {status && <div className="status">{status}</div>}
        {error && <div className="status error">{error}</div>}
      </div>

      {contract && (
        <div className="panel">
          <h2>// Compiled Contract</h2>
          <pre className="output">{contract}</pre>
        </div>
      )}

      {(mechaProgress.length > 0 || mechaReport) && (
        <div className="panel">
          <h2>// MECHA RUN Telemetry</h2>
          <pre className="output">
            {mechaProgress
              .map((p) => {
                if (p.type === "start") return `[BOOT] model=${p.model} max_iter=${p.max_iter} ceiling=$${p.ceiling}`;
                if (p.type === "action") return `[${String(p.iter).padStart(2, "0")}] ${p.tool} ${p.summary || ""} ($${p.cost})`;
                if (p.type === "text") return `[${String(p.iter).padStart(2, "0")}] THINK: ${p.text}`;
                if (p.type === "error") return `[${String(p.iter).padStart(2, "0")}] ERROR: ${p.error}`;
                if (p.type === "finish") return `[EXIT] code=${p.exit_code} ${p.exit_name}`;
                return JSON.stringify(p);
              })
              .join("\n")}
          </pre>
          {mechaReport && (
            <>
              <h2>// MECHA Final Report — exit {mechaReport.exit_code} {mechaReport.exit_name}</h2>
              <pre className="output">{mechaReport.report}</pre>
              <div className="row">
                <button className="btn-ghost" onClick={() => copy(mechaReport.report, "Final report")}>COPY REPORT</button>
                <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">SHARE ON X</a>
              </div>
            </>
          )}
        </div>
      )}

      {output && (
        <div className="panel">
          <h2>// The Verdict</h2>
          <pre className="output">{output}</pre>
          <div className="row">
            <button className="btn-ghost" onClick={() => copy(output, "Verdict")}>COPY VERDICT</button>
            <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">SHARE ON X</a>
          </div>
        </div>
      )}

      <div className="footer">
        LOOP PROTOCOL v5.0 — built by <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">@JoePro</a> × Devin.
        One run = one paid audit. The Wringer never fabricates a SUCCESS.
      </div>
    </main>
  );
}
