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

  const formState = useCallback(
    () => ({ goal, acs, nonGoals, maxIterations, preauthorized }),
    [goal, acs, nonGoals, maxIterations, preauthorized]
  );

  const runWithSession = useCallback(async (sessionId, form) => {
    setRunning(true);
    setError("");
    setStatus("MECHA ENGAGED — running your contract through the loop...");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("canceled")) setStatus("Payment canceled. The Mecha waits.");
    if (sessionId) {
      const saved = localStorage.getItem("mecha_form");
      if (saved) {
        const form = JSON.parse(saved);
        setGoal(form.goal || "");
        setAcs(form.acs && form.acs.length ? form.acs : [{ ...EMPTY_AC }]);
        setNonGoals(form.nonGoals || "");
        setMaxIterations(form.maxIterations || 30);
        setPreauthorized(form.preauthorized || "");
        window.history.replaceState({}, "", "/");
        runWithSession(sessionId, form);
      }
    }
  }, [runWithSession]);

  function compile() {
    setError("");
    if (!goal.trim()) return setError("Goal is required. The Mecha refuses vague missions.");
    setContract(buildContract(formState()));
  }

  async function mechaRun() {
    setError("");
    if (!goal.trim()) return setError("Goal is required. The Mecha refuses vague missions.");
    const form = formState();
    localStorage.setItem("mecha_form", JSON.stringify(form));
    setRunning(true);
    setStatus("Opening payment gate...");
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.free) {
        await runWithSession(null, form);
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
    "I just ran my agent contract through the MECHA (Loop Protocol v5.0) and it graded my acceptance criteria. Brutal. ⚙️"
  )}&url=${encodeURIComponent("https://mecha-auth-run.vercel.app")}`;

  return (
    <main className="wrap">
      <h1>⚙ MECHA AUTH RUN</h1>
      <p className="sub">
        Fill out your agent contract → the Mecha compiles it into LOOP PROTOCOL v5.0 → pays-per-run audit + dry-run.
        Honest failure outranks fabricated success. Always.
      </p>

      <div className="panel">
        <h2>// Mission Contract</h2>
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

        <button className="btn-run" onClick={mechaRun} disabled={running}>
          {running ? <span className="blink">▮▮ MECHA ENGAGED ▮▮</span> : "⚙ MECHA AUTH RUN — $1"}
        </button>
        {status && <div className="status">{status}</div>}
        {error && <div className="status error">{error}</div>}
      </div>

      {contract && (
        <div className="panel">
          <h2>// Compiled Contract</h2>
          <pre className="output">{contract}</pre>
        </div>
      )}

      {output && (
        <div className="panel">
          <h2>// Mecha Verdict</h2>
          <pre className="output">{output}</pre>
          <div className="row">
            <button className="btn-ghost" onClick={() => copy(output, "Verdict")}>COPY VERDICT</button>
            <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">SHARE ON X</a>
          </div>
        </div>
      )}

      <div className="footer">
        LOOP PROTOCOL v5.0 — built by <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">@JoePro</a> × Devin.
        One run = one paid audit. The Mecha never fabricates a SUCCESS.
      </div>
    </main>
  );
}
