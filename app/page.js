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
  const [mechaStrategy, setMechaStrategy] = useState("triumvirate");
  const [mechaProgress, setMechaProgress] = useState([]);
  const [mechaReport, setMechaReport] = useState(null);

  const formState = useCallback(
    () => ({ goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy }),
    [goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy]
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
          setStatus(`MECHA RUN COMPLETE — exit ${data.report.exit_code} ${data.report.exit_name} · ${data.report.strategy} · $${Number(data.report.cost_usd || 0).toFixed(4)} model cost`);
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
      setStatus(`MECHA RUN LIVE — strategy ${data.strategy} fanning out in sandbox. This takes minutes, not seconds.`);
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
        if (form.mechaStrategy) setMechaStrategy(form.mechaStrategy);
        window.history.replaceState({}, "", "/");
        if (tier === "mecha") startMecha(sessionId, form);
        else runWithSession(sessionId, form);
        document.getElementById("results")?.scrollIntoView();
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
    if (!goal.trim()) {
      setError("Goal is required. The Wringer refuses vague missions.");
      document.getElementById("work-order")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
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

  // Reviewer's "winner" counts only non-failed candidates; map it back to the
  // full candidates array.
  const mechaWinnerIdx = (() => {
    if (!mechaReport?.winner || !mechaReport.candidates) return -1;
    let n = 0;
    for (let i = 0; i < mechaReport.candidates.length; i++) {
      const c = mechaReport.candidates[i];
      if (c.text && !c.error) {
        n++;
        if (n === mechaReport.winner) return i;
      }
    }
    return -1;
  })();

  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "I just put my agent task through The Wringer. It auto-repaired my acceptance criteria and graded the whole contract. Brutal."
  )}&url=${encodeURIComponent("https://thewringer.ai")}`;

  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <span className="hero-kicker mono">Loop Protocol v5.0 · No fabricated SUCCESS</span>
          <h1>
            The
            <br />
            <span className="red">Wringer</span>
          </h1>
          <p className="hero-sub">
            Most agent tasks fail before the agent even starts — vague goals, unverifiable criteria,
            no safety gates. Write yours down, and The Wringer will press it flat: audit it for $1,
            or execute it for real through a multi-agent swarm for $10.
          </p>
          <div className="hero-ctas">
            <a className="btn-stamp" href="#work-order">Put it through the press</a>
            <a className="btn-outline" href="#how">How it works</a>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="steps" id="how">
        <div className="steps-inner">
          <div className="step">
            <div className="num">Step 01</div>
            <h3>Write the work order</h3>
            <p>One-sentence goal, mechanically checkable acceptance criteria, explicit non-goals. The form forces precision.</p>
          </div>
          <div className="step">
            <div className="num">Step 02</div>
            <h3>Through the press</h3>
            <p>$1 — a brutal audit + 5-iteration dry-run grades your contract. $10 — the real MECHA orchestrator executes it: Claude, Codex, and Grok fan out in an isolated sandbox, a reviewer synthesizes.</p>
          </div>
          <div className="step">
            <div className="num">Step 03</div>
            <h3>Get the verdict</h3>
            <p>A graded verdict or a final report with a real exit code and model cost. Honest failure outranks fabricated success. Always.</p>
          </div>
        </div>
      </section>

      {/* WORK ORDER + TIERS */}
      <section className="shop" id="work-order">
        <div className="ticket">
          <div className="ticket-head">
            <h2>Work Order</h2>
            <span className="no">FORM W-1 · LOOP PROTOCOL v5.0</span>
          </div>

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
          <button className="btn-ghost" onClick={() => setAcs([...acs, { ...EMPTY_AC }])}>+ Add criterion</button>

          <label>Non-goals (explicitly out of scope)</label>
          <input value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} placeholder="No refactors, no dependency upgrades, no prod deploys" />

          <label>Max iterations</label>
          <input type="number" min="5" max="100" value={maxIterations} onChange={(e) => setMaxIterations(parseInt(e.target.value || "30", 10))} />

          <label>Preauthorized irreversible / outward actions (verbatim, or leave empty)</label>
          <input value={preauthorized} onChange={(e) => setPreauthorized(e.target.value)} placeholder='e.g. "git push origin feature-branch"' />

          <div className="row">
            <button className="btn-ghost" onClick={compile}>Compile contract</button>
            {contract && <button className="btn-ghost" onClick={() => copy(buildPrompt(formState()), "Full protocol prompt")}>Copy full prompt</button>}
          </div>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
        </div>

        <aside className="tiers">
          <div className="tier">
            <div className="price">$1</div>
            <h3>The Audit</h3>
            <p>
              Your contract gets compiled into Loop Protocol v5.0, audited, dry-run for 5 iterations,
              and graded. Weak criteria get repaired. Instant.
            </p>
            <button className="btn-stamp" onClick={() => wringerRun("audit")} disabled={running}>
              {running ? <span className="blink">In the wringer…</span> : "Put it through — $1"}
            </button>
            <p className="promo-hint">Have a press pass code? Enter it at checkout.</p>
          </div>

          <div className="tier feature">
            <div className="price">$10</div>
            <h3>MECHA Run</h3>
            <p>
              Real execution, not a dry-run. The MECHA orchestrator dispatches your contract to a swarm of
              worker agents — Claude, Codex, Grok lineages — in an isolated sandbox. A reviewer synthesizes
              the best answer. Final report + exit code.
            </p>
            <label>Strategy</label>
            <select value={mechaStrategy} onChange={(e) => setMechaStrategy(e.target.value)}>
              <option value="senate">senate — every backend answers, reviewer merges</option>
              <option value="triumvirate">triumvirate — Claude + Codex + Grok + reviewer</option>
              <option value="best-of-3">best-of-3 — three personas, reviewer picks</option>
              <option value="solo-claude">solo-claude — Claude at max thinking</option>
              <option value="solo-codex">solo-codex — Codex at max thinking</option>
              <option value="frontier-coder">frontier-coder — TDD: test, implement, review</option>
            </select>
            <div style={{ height: 16 }} />
            <button className="btn-stamp" onClick={() => wringerRun("mecha")} disabled={running}>
              {running ? <span className="blink">MECHA engaged…</span> : "MECHA Run — $10"}
            </button>
            <p className="promo-hint">Press pass codes work here too.</p>
          </div>
        </aside>
      </section>

      {/* RESULTS */}
      <section className="results" id="results">
        {contract && (
          <div className="panel">
            <h2>Compiled Contract</h2>
            <pre className="output">{contract}</pre>
          </div>
        )}

        {(mechaProgress.length > 0 || mechaReport) && (
          <div className="panel">
            <h2>MECHA Run Telemetry</h2>
            <pre className="output">
              {mechaProgress
                .map((p) => {
                  if (p.kind === "run_start") return `[BOOT] ${p.run_id} strategy=${p.strategy}`;
                  if (p.kind === "strategy_start") return `[FANOUT] ${p.strategy} — ${p.workers ?? (p.worker_list || []).length} workers: ${(p.worker_list || []).map((w) => w.name).join(", ")}`;
                  if (p.kind === "worker_start") return `[WORKER] ${p.name} (${p.backend}) engaged`;
                  if (p.kind === "worker_done") return `[WORKER] ${p.name} ${p.error ? `FAILED: ${p.error}` : "answered"}`;
                  if (p.kind === "reviewer_start") return `[REVIEW] ${p.name} judging ${p.n_candidates} candidates`;
                  if (p.kind === "reviewer_done") return `[REVIEW] ${p.name || "Reviewer"} ${p.error ? `FAILED: ${p.error}` : "verdict in"}`;
                  if (p.kind === "run_done") return `[DONE] cost=$${Number(p.cost_usd || 0).toFixed(4)} time=${Number(p.elapsed_s || 0).toFixed(1)}s${p.error ? ` error=${p.error}` : ""}`;
                  if (p.kind === "gamma_start") return `[GAMMA] compiling HQ report (${p.model}) — worth the wait`;
                  if (p.kind === "gamma_done") return p.ok ? `[GAMMA] HQ report ready · $${Number(p.cost_usd || 0).toFixed(4)} · ${Number(p.elapsed_s || 0).toFixed(1)}s` : `[GAMMA] skipped: ${p.error}`;
                  if (p.kind === "gamma_presentation_start") return `[GAMMA] generating HD presentation (gamma.app)`;
                  if (p.kind === "gamma_presentation_done") return p.ok ? `[GAMMA] HD presentation ready · ${Number(p.elapsed_s || 0).toFixed(1)}s` : `[GAMMA] presentation skipped: ${p.error || "timeout"}`;
                  return `[${p.kind}] ${JSON.stringify({ ...p, ts: undefined, run_id: undefined })}`;
                })
                .join("\n")}
            </pre>
            {mechaReport && (
              <>
                <h2 style={{ marginTop: 22 }}>MECHA Final Report — exit {mechaReport.exit_code} {mechaReport.exit_name}</h2>
                <div className="mecha-stats mono">
                  <span className="stat">strategy {mechaReport.strategy}</span>
                  <span className="stat">model cost ${Number(mechaReport.cost_usd || 0).toFixed(4)}</span>
                  <span className="stat">{Number(mechaReport.elapsed_s || 0).toFixed(1)}s</span>
                  {(mechaReport.total_input_tokens || mechaReport.total_output_tokens) ? (
                    <span className="stat">{mechaReport.total_input_tokens || 0} tok in / {mechaReport.total_output_tokens || 0} tok out</span>
                  ) : null}
                  {mechaReport.run_id && <span className="stat">{mechaReport.run_id}</span>}
                </div>
                {mechaReport.gamma && (
                  <div className="verdict gamma">
                    <div className="verdict-head mono">
                      GAMMA REPORT — HQ deliverable ({mechaReport.gamma_model})
                    </div>
                    <pre className="output">{mechaReport.gamma}</pre>
                    <div className="row">
                      <button className="btn-ghost" onClick={() => copy(mechaReport.gamma, "GAMMA report")}>Copy GAMMA report</button>
                      {mechaReport.gamma_presentation_url && (
                        <a href={mechaReport.gamma_presentation_url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ textDecoration: "none" }}>View HD Presentation</a>
                      )}
                      {mechaReport.gamma_export_url && (
                        <a href={mechaReport.gamma_export_url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ textDecoration: "none" }}>Download PDF</a>
                      )}
                    </div>
                  </div>
                )}
                {mechaReport.reviewer && (
                  <div className="verdict">
                    <div className="verdict-head mono">
                      {mechaReport.reviewer.name || "Reviewer"} verdict
                      {mechaReport.winner ? ` — winner: candidate ${mechaReport.winner}${mechaWinnerIdx >= 0 ? ` (${mechaReport.candidates[mechaWinnerIdx].name})` : ""}` : ""}
                      {mechaReport.confidence != null ? ` · confidence ${mechaReport.confidence}` : ""}
                    </div>
                    <pre className="output">{mechaReport.reviewer.text || mechaReport.reviewer.error || "(no reviewer output)"}</pre>
                  </div>
                )}
                <pre className="output">{mechaReport.report}</pre>
                {mechaReport.candidates?.length > 0 && (
                  <>
                    <h2 style={{ marginTop: 22 }}>Worker Candidates — full evidence chain</h2>
                    {mechaReport.candidates.map((c, i) => (
                      <details className="worker" key={i} open={mechaWinnerIdx === i}>
                        <summary className="mono">
                          {mechaWinnerIdx === i ? "★ " : ""}Candidate {i + 1} · {c.name} ({c.backend}){" "}
                          {c.error
                            ? `— FAILED: ${c.error}`
                            : `— ${c.output_tokens || 0} tok out · $${Number(c.cost_usd || 0).toFixed(4)} · ${Number(c.elapsed_s || 0).toFixed(1)}s`}
                        </summary>
                        <pre className="output">{c.text || "(no output)"}</pre>
                      </details>
                    ))}
                  </>
                )}
                {mechaReport.artifacts?.length > 0 && (
                  <>
                    <h2 style={{ marginTop: 22 }}>Workspace Artifacts</h2>
                    {mechaReport.artifacts.map((a, i) => (
                      <details className="worker" key={i}>
                        <summary className="mono">{a.path}</summary>
                        <pre className="output">{a.content}</pre>
                      </details>
                    ))}
                  </>
                )}
                <div className="row">
                  <button className="btn-ghost" onClick={() => copy(mechaReport.report, "Final report")}>Copy report</button>
                  <button className="btn-ghost" onClick={() => copy(JSON.stringify(mechaReport, null, 2), "Full run record (JSON)")}>Copy full run JSON</button>
                  <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">Share on X</a>
                </div>
              </>
            )}
          </div>
        )}

        {output && (
          <div className="panel">
            <h2>The Verdict</h2>
            <pre className="output">{output}</pre>
            <div className="row">
              <button className="btn-ghost" onClick={() => copy(output, "Verdict")}>Copy verdict</button>
              <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">Share on X</a>
            </div>
          </div>
        )}
      </section>

      <div className="footer">
        LOOP PROTOCOL v5.0 — built by <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">@JoePro</a> × Devin.
        One run = one paid audit. The Wringer never fabricates a SUCCESS.
      </div>
    </main>
  );
}
