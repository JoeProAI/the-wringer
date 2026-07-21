"use client";

import { useEffect, useState, useCallback } from "react";
import { buildContract, buildPrompt } from "../lib/protocol";

const EMPTY_AC = { text: "", kind: "AUTO", check: "", expect: "" };

const megaPriceCents = (a) => {
  const n = Math.max(3, Math.min(100, Number(a) || 0));
  return n <= 4 ? 1000 : Math.min(1000 + 35 * (n - 4), 4000);
};
const fmtUSD = (cents) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);

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
  const [mechaAgents, setMechaAgents] = useState(24);
  const [mechaProgress, setMechaProgress] = useState([]);
  const [mechaReport, setMechaReport] = useState(null);
  const [assistMsg, setAssistMsg] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistLog, setAssistLog] = useState([]);
  const [assistTips, setAssistTips] = useState([]);

  const formState = useCallback(
    () => ({ goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy, mechaAgents }),
    [goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy, mechaAgents]
  );

  const runWithSession = useCallback(async (sessionId, form) => {
    setRunning(true);
    setError("");
    setStatus("IN THE WRINGER — auditing your work order...");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setOutput(data.output);
      setStatus(`AUDIT COMPLETE — model: ${data.model}`);
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
        // keep polling
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
        if (form.mechaAgents) setMechaAgents(form.mechaAgents);
        window.history.replaceState({}, "", "/");
        if (tier === "mecha") startMecha(sessionId, form);
        else runWithSession(sessionId, form);
        document.getElementById("results")?.scrollIntoView();
      }
    }
  }, [runWithSession, startMecha]);

  function compile() {
    setError("");
    if (!goal.trim()) return setError("Goal is required. Say what must be true when the agent stops.");
    setContract(buildContract(formState()));
  }

  async function wringerRun(tier) {
    setError("");
    if (!goal.trim()) {
      setError("Goal is required. Say what must be true when the agent stops.");
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
        body: JSON.stringify({
          tier,
          agents: tier === "mecha" && mechaStrategy === "mega" ? mechaAgents : undefined,
        }),
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

  async function runAssist(e) {
    e?.preventDefault?.();
    const message = assistMsg.trim();
    if (!message || assistBusy) return;
    setAssistBusy(true);
    setError("");
    setAssistLog((log) => [...log, { role: "user", text: message }]);
    setAssistMsg("");
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, form: formState() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assist failed");
      if (data.form) {
        setGoal(data.form.goal || "");
        setAcs(data.form.acs?.length ? data.form.acs : [{ ...EMPTY_AC }]);
        setNonGoals(data.form.nonGoals || "");
        setMaxIterations(data.form.maxIterations || 30);
        setPreauthorized(data.form.preauthorized || "");
        setContract(buildContract(data.form));
      }
      if (data.tips?.length) setAssistTips(data.tips);
      setAssistLog((log) => [
        ...log,
        { role: "assistant", text: data.reply || "Draft filled into the form. Review it before you pay." },
      ]);
      setStatus("Grok filled the work order. Read it, then audit or run.");
    } catch (err) {
      setAssistLog((log) => [...log, { role: "assistant", text: `Could not draft that: ${err.message}` }]);
    } finally {
      setAssistBusy(false);
    }
  }

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
    "I put my agent task through The Wringer. Clear goal, checkable criteria, real verdict."
  )}&url=${encodeURIComponent("https://thewringer.ai")}`;

  const megaOn = mechaStrategy === "mega";
  const megaCents = megaPriceCents(mechaAgents);

  return (
    <main>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <span className="hero-kicker mono">Turn vague agent ideas into real work orders</span>
          <h1>
            The
            <br />
            <span className="red">Wringer</span>
          </h1>
          <p className="hero-sub">
            Agents fail on mushy goals. Describe what you want in plain English — or talk it through with Grok —
            and The Wringer turns it into a tight work order. Then pay $1 for a brutal audit, or $10 for a real
            multi-agent MECHA run that has to prove the result.
          </p>
          <div className="hero-ctas">
            <a className="btn-stamp" href="#work-order">Build a work order</a>
            <a className="btn-outline" href="#how">How it works</a>
          </div>
        </div>
      </section>

      <section className="steps" id="how">
        <div className="steps-inner">
          <div className="step">
            <div className="num">Step 01</div>
            <h3>Name the outcome</h3>
            <p>
              One clear goal, a few checks anyone could verify, and what is out of scope.
              Chat with Grok if you only have a rough idea — it fills the form for you.
            </p>
          </div>
          <div className="step">
            <div className="num">Step 02</div>
            <h3>Pick the press</h3>
            <p>
              $1 Audit stress-tests the work order itself. $10 MECHA Run actually executes it with Claude, Codex,
              and Grok workers in a sandbox, then a reviewer collapses the answers.
            </p>
          </div>
          <div className="step">
            <div className="num">Step 03</div>
            <h3>Read the verdict</h3>
            <p>
              Audits grade weak criteria and dry-run the loop. MECHA runs return a real exit code, cost, winner,
              and full evidence chain. Honest failure beats fake SUCCESS.
            </p>
          </div>
        </div>
      </section>

      <section className="shop" id="work-order">
        <div className="ticket">
          <div className="ticket-head">
            <h2>Work Order</h2>
            <span className="no">FORM W-1 · WHAT THE AGENT MUST PROVE</span>
          </div>

          <div className="assist">
            <div className="assist-head mono">Grok work-order coach</div>
            <p className="field-help">
              Dump the messy version here. Grok turns it into a goal, checkable criteria, and non-goals,
              then drops them into the fields below.
            </p>
            <div className="assist-log">
              {assistLog.length === 0 && (
                <div className="assist-bubble assistant">
                  Example: &quot;I need an agent to add a /healthz route that returns 200 and the git SHA, no other refactors.&quot;
                </div>
              )}
              {assistLog.map((m, i) => (
                <div key={i} className={`assist-bubble ${m.role}`}>{m.text}</div>
              ))}
            </div>
            <form className="assist-form" onSubmit={runAssist}>
              <input
                value={assistMsg}
                onChange={(e) => setAssistMsg(e.target.value)}
                placeholder="Describe the job in plain English..."
                disabled={assistBusy || running}
              />
              <button className="btn-stamp" type="submit" disabled={assistBusy || running || !assistMsg.trim()}>
                {assistBusy ? <span className="blink">Drafting…</span> : "Fill form"}
              </button>
            </form>
          </div>

          <label>Goal</label>
          <p className="field-help">One sentence. What must be true when the agent is done — not the steps, the finished state.</p>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="A /healthz endpoint returns HTTP 200 and includes the current git SHA in the body"
          />

          <label>Done checks</label>
          <p className="field-help">
            Each line should be something you can prove with a command, URL, file, or screenshot.
            AUTO = machine-checkable. HUMAN = you have to look.
          </p>
          {acs.map((ac, i) => (
            <div className="ac-row" key={i}>
              <select value={ac.kind} onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, kind: e.target.value } : a)))}>
                <option value="AUTO">AUTO</option>
                <option value="HUMAN">HUMAN</option>
              </select>
              <input
                value={ac.text}
                placeholder={`Check ${i + 1}: e.g. curl -s localhost:3000/healthz returns 200 and contains the SHA`}
                onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, text: e.target.value } : a)))}
              />
              <button className="btn-ghost" onClick={() => setAcs(acs.filter((_, j) => j !== i))} disabled={acs.length === 1}>✕</button>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => setAcs([...acs, { ...EMPTY_AC }])}>+ Add check</button>

          <label>Out of scope</label>
          <p className="field-help">What the agent must not touch. This stops drive-by refactors and surprise deploys.</p>
          <input value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} placeholder="No dependency upgrades, no UI redesign, no production deploy" />

          <label>Max attempts</label>
          <p className="field-help">How many loop iterations before it must stop. 20-40 is normal. Tiny jobs can be 15.</p>
          <input type="number" min="5" max="100" value={maxIterations} onChange={(e) => setMaxIterations(parseInt(e.target.value || "30", 10))} />

          <label>Allowed risky actions</label>
          <p className="field-help">
            Only list irreversible or outward actions you already approve, word for word.
            Leave blank if it should not push, email, buy, or delete anything.
          </p>
          <input value={preauthorized} onChange={(e) => setPreauthorized(e.target.value)} placeholder='Optional: git push origin feature/healthz' />

          <div className="row">
            <button className="btn-ghost" onClick={compile}>Preview compiled contract</button>
            {contract && <button className="btn-ghost" onClick={() => copy(buildPrompt(formState()), "Full protocol prompt")}>Copy full prompt</button>}
          </div>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
          {assistTips.length > 0 && (
            <ul className="tips">
              {assistTips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>

        <aside className="tiers">
          <div className="tier">
            <div className="price">$1</div>
            <h3>The Audit</h3>
            <p>
              Stress-tests the work order itself. Grades weak criteria, dry-runs the loop for a few iterations,
              and tells you what would break before you spend real agent time.
            </p>
            <button className="btn-stamp" onClick={() => wringerRun("audit")} disabled={running}>
              {running ? <span className="blink">In the wringer…</span> : "Audit work order — $1"}
            </button>
            <p className="promo-hint">Have a press pass code? Enter it at checkout.</p>
          </div>

          <div className="tier feature">
            <div className="price">{megaOn ? fmtUSD(megaCents) : "$10"}</div>
            <h3>MECHA Run</h3>
            <p>
              Real execution in an isolated sandbox. Multiple worker agents take the same work order,
              then a reviewer picks or merges the best answer. You get the final report, exit code, and evidence.
            </p>
            <label>Strategy</label>
            <select value={mechaStrategy} onChange={(e) => setMechaStrategy(e.target.value)}>
              <option value="senate">senate — every backend answers, reviewer merges</option>
              <option value="triumvirate">triumvirate — Claude + Codex + Grok + reviewer</option>
              <option value="mega">mega — N agents across lineages, tournament judge</option>
              <option value="best-of-3">best-of-3 — three personas, reviewer picks</option>
              <option value="solo-claude">solo-claude — Claude at max thinking</option>
              <option value="solo-codex">solo-codex — Codex at max thinking</option>
              <option value="frontier-coder">frontier-coder — TDD: test, implement, review</option>
            </select>
            {megaOn && (
              <div className="mega-config">
                <label>
                  Agents — {mechaAgents} <span className="mono">({fmtUSD(megaCents)})</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="100"
                  value={mechaAgents}
                  onChange={(e) => setMechaAgents(parseInt(e.target.value, 10))}
                />
                <p className="promo-hint">
                  {mechaAgents} agents fan out across Claude / Codex / Grok lineages, then a tournament reviewer
                  collapses them. More agents is not always better — verification is the point. Min run stays $10.
                </p>
              </div>
            )}
            <div style={{ height: 16 }} />
            <button className="btn-stamp" onClick={() => wringerRun("mecha")} disabled={running}>
              {running ? (
                <span className="blink">MECHA engaged…</span>
              ) : megaOn ? (
                `MEGA MECHA Run — ${fmtUSD(megaCents)} · ${mechaAgents} agents`
              ) : (
                "Run with MECHA — $10"
              )}
            </button>
            <p className="promo-hint">Press pass codes work here too.</p>
          </div>
        </aside>
      </section>

      <section className="guide" id="read-results">
        <div className="guide-inner">
          <h2>How to read what comes back</h2>
          <div className="guide-grid">
            <div>
              <h3>Audit ($1)</h3>
              <ul>
                <li><strong>Repaired criteria</strong> means your checks were too vague. Keep the repairs unless they changed intent.</li>
                <li><strong>Dry-run grades</strong> show whether the loop could even pretend to verify the work.</li>
                <li>If the audit says the goal is uncheckable, fix the form before paying for MECHA.</li>
              </ul>
            </div>
            <div>
              <h3>MECHA Run ($10+)</h3>
              <ul>
                <li><strong>Exit 0 SUCCESS</strong> = all checks verified with evidence. Rare and earned.</li>
                <li><strong>PARTIAL / NEEDS_HUMAN / STALLED</strong> is still useful — read what failed and why.</li>
                <li><strong>Winner / candidates</strong> is the evidence chain. Open the winner first, then compare losers.</li>
                <li><strong>Model cost</strong> is LLM spend inside the sandbox, separate from what you paid The Wringer.</li>
              </ul>
            </div>
            <div>
              <h3>Good inputs look like</h3>
              <ul>
                <li>Goal names a finished state: &quot;endpoint returns X&quot;, not &quot;work on health checks&quot;.</li>
                <li>Each check could be proven by a stranger with a terminal or browser.</li>
                <li>Out of scope blocks surprise rewrites.</li>
                <li>Risky actions stay empty unless you truly want push/email/delete.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="results" id="results">
        {contract && (
          <div className="panel">
            <h2>Compiled Contract</h2>
            <p className="field-help">Machine form of your work order. This is what gets audited or executed.</p>
            <pre className="output">{contract}</pre>
          </div>
        )}

        {(mechaProgress.length > 0 || mechaReport) && (
          <div className="panel">
            <h2>MECHA Run Telemetry</h2>
            <p className="field-help">Live breadcrumbs from the sandbox. Workers answering, reviewers judging, bracket rounds if mega.</p>
            <pre className="output">
              {mechaProgress
                .map((p) => {
                  if (p.kind === "run_start") return `[BOOT] ${p.run_id} strategy=${p.strategy}`;
                  if (p.kind === "strategy_start" && p.strategy === "mega") return `[FANOUT] mega — ${p.agents ?? p.workers ?? (p.worker_list || []).length} agents${p.concurrency ? `, ${p.concurrency}/wave` : ""}${(p.lineages || []).length ? ` across ${(p.lineages || []).join(", ")}` : ""}`;
                  if (p.kind === "strategy_start") return `[FANOUT] ${p.strategy} — ${p.workers ?? (p.worker_list || []).length} workers: ${(p.worker_list || []).map((w) => w.name).join(", ")}`;
                  if (p.kind === "worker_start") return `[WORKER] ${p.name} (${p.backend}) engaged`;
                  if (p.kind === "worker_done") return `[WORKER] ${p.name} ${p.error ? `FAILED: ${p.error}` : "answered"}`;
                  if (p.kind === "reviewer_start") return `[REVIEW] ${p.name} judging ${p.n_candidates} candidates`;
                  if (p.kind === "reviewer_done") return `[REVIEW] ${p.name || "Reviewer"} ${p.error ? `FAILED: ${p.error}` : "verdict in"}`;
                  if (p.kind === "mega_layer_start") return `[BRACKET] layer ${p.layer} — ${p.pods} judge pod${p.pods === 1 ? "" : "s"} over ${p.candidates} candidates`;
                  if (p.kind === "mega_pod_done") return `[BRACKET] L${p.layer}.${p.pod} → winner ${p.winner}${p.confidence != null ? ` (conf ${p.confidence})` : ""}`;
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
                  {mechaReport.agents ? <span className="stat">{mechaReport.succeeded ?? "?"}/{mechaReport.agents} agents survived</span> : null}
                  {mechaReport.layers ? <span className="stat">{mechaReport.layers} bracket layers</span> : null}
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
            <h2>The Audit Verdict</h2>
            <p className="field-help">
              Read repaired criteria first, then the dry-run notes. If checks are still mushy, fix the form and audit again before a MECHA run.
            </p>
            <pre className="output">{output}</pre>
            <div className="row">
              <button className="btn-ghost" onClick={() => copy(output, "Verdict")}>Copy verdict</button>
              <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">Share on X</a>
            </div>
          </div>
        )}
      </section>

      <div className="footer">
        Built by <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">@JoePro</a>.
        One paid run, one honest verdict. The Wringer never fabricates a SUCCESS.
      </div>
    </main>
  );
}
