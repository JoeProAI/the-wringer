"use client";

import { useEffect, useState, useCallback } from "react";
import { buildContract, buildPrompt } from "../lib/protocol";
import {
  buildDraftShareUrl,
  clearDraftLocal,
  decodeDraftParam,
  formHasContent,
  loadDraftLocal,
  normalizeForm,
  saveDraftLocal,
} from "../lib/draft";
import { extractRepairedForm } from "../lib/parse-audit";
import { FAQS } from "../lib/faq";
import { track } from "../lib/analytics";

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
  const [draftNote, setDraftNote] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [repairedPreview, setRepairedPreview] = useState(null);

  const formState = useCallback(
    () => ({ goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy, mechaAgents }),
    [goal, acs, nonGoals, maxIterations, preauthorized, mechaStrategy, mechaAgents]
  );

  const applyForm = useCallback((raw, { save = true, note = "" } = {}) => {
    const form = normalizeForm(raw);
    setGoal(form.goal);
    setAcs(form.acs);
    setNonGoals(form.nonGoals);
    setMaxIterations(form.maxIterations);
    setPreauthorized(form.preauthorized);
    if (form.mechaStrategy) setMechaStrategy(form.mechaStrategy);
    if (form.mechaAgents) setMechaAgents(form.mechaAgents);
    setContract(form.goal ? buildContract(form) : "");
    if (save && formHasContent(form)) {
      const saved = saveDraftLocal(form);
      if (saved?.savedAt) {
        setDraftNote(note || `Draft saved ${new Date(saved.savedAt).toLocaleString()}`);
      }
    }
    return form;
  }, []);

  const runWithSession = useCallback(async (sessionId, form) => {
    setRunning(true);
    setError("");
    setStatus("IN THE WRINGER - auditing your work order...");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setOutput(data.output);
      const repaired = extractRepairedForm(data.output || "");
      setRepairedPreview(repaired);
      track("audit_complete", { model: data.model, repaired: Boolean(repaired) });
      setStatus(
        repaired
          ? `AUDIT COMPLETE - model: ${data.model}. Repairs ready to apply.`
          : `AUDIT COMPLETE - model: ${data.model}`
      );
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
          track("mecha_complete", {
            exit_code: data.report.exit_code,
            strategy: data.report.strategy,
            cost_usd: Number(data.report.cost_usd || 0),
          });
          setStatus(
            `MECHA RUN COMPLETE - exit ${data.report.exit_code} ${data.report.exit_name} · ${data.report.strategy} · $${Number(
              data.report.cost_usd || 0
            ).toFixed(4)} model cost`
          );
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

  const startMecha = useCallback(
    async (sessionId, form) => {
      setRunning(true);
      setError("");
      setMechaReport(null);
      setMechaProgress([]);
      setStatus("MECHA RUN - provisioning sandbox...");
      try {
        const res = await fetch("/api/mecha/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "MECHA start failed");
        setStatus(`MECHA RUN LIVE - strategy ${data.strategy} fanning out in sandbox. This takes minutes, not seconds.`);
        pollMecha(data.runId, sessionId);
      } catch (e) {
        setError(e.message);
        setStatus("");
        setRunning(false);
      }
    },
    [pollMecha]
  );

  // Restore share-link draft, local draft, or post-checkout form
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const tier = params.get("tier");
    const draftParam = params.get("draft");

    if (params.get("canceled")) setStatus("Payment canceled. The Wringer waits.");

    if (sessionId) {
      const saved = localStorage.getItem("wringer_form");
      if (saved) {
        try {
          const form = normalizeForm(JSON.parse(saved));
          applyForm(form, { save: true, note: "Restored checkout draft" });
          window.history.replaceState({}, "", "/");
          if (tier === "mecha") startMecha(sessionId, form);
          else runWithSession(sessionId, form);
          document.getElementById("results")?.scrollIntoView();
          return;
        } catch {
          // fall through
        }
      }
    }

    if (draftParam) {
      const shared = decodeDraftParam(draftParam);
      if (shared && formHasContent(shared)) {
        applyForm(shared, { save: true, note: "Loaded shared draft link" });
        window.history.replaceState({}, "", window.location.pathname);
        document.getElementById("work-order")?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }

    const local = loadDraftLocal();
    if (local?.form && formHasContent(local.form)) {
      applyForm(local.form, {
        save: false,
        note: local.savedAt ? `Restored local draft from ${new Date(local.savedAt).toLocaleString()}` : "Restored local draft",
      });
      setDraftNote(
        local.savedAt ? `Restored local draft from ${new Date(local.savedAt).toLocaleString()}` : "Restored local draft"
      );
    }
  }, [runWithSession, startMecha, applyForm]);

  // Autosave drafts while editing
  useEffect(() => {
    const form = formState();
    if (!formHasContent(form)) return;
    const tmr = setTimeout(() => {
      const saved = saveDraftLocal(form);
      if (saved?.savedAt) setDraftNote(`Draft autosaved ${new Date(saved.savedAt).toLocaleTimeString()}`);
    }, 600);
    return () => clearTimeout(tmr);
  }, [formState]);

  function compile() {
    setError("");
    if (!goal.trim()) return setError("Goal is required. Say what done looks like.");
    setContract(buildContract(formState()));
  }

  async function wringerRun(tier) {
    setError("");
    if (!goal.trim()) {
      setError("Goal is required. Say what done looks like.");
      document.getElementById("work-order")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const form = formState();
    localStorage.setItem("wringer_form", JSON.stringify(form));
    setRunning(true);
    setStatus("Opening payment gate...");
    track("checkout_started", { tier });
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

  function saveDraftNow() {
    const form = formState();
    if (!formHasContent(form)) {
      setDraftNote("Nothing to save yet.");
      return;
    }
    const saved = saveDraftLocal(form);
    setDraftNote(`Draft saved ${new Date(saved.savedAt).toLocaleString()}`);
    setStatus("Draft saved on this device.");
    track("draft_saved");
  }

  async function copyShareLink() {
    const form = formState();
    if (!form.goal.trim()) {
      setShareNote("Add a goal before sharing.");
      return;
    }
    const url = buildDraftShareUrl(form);
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Share link copied. Anyone with the link gets this work order.");
      setStatus("Draft link copied.");
    } catch {
      setShareNote(url);
      setStatus("Could not copy automatically. Link is shown below.");
    }
  }

  function clearDraftNow() {
    clearDraftLocal();
    applyForm(
      {
        goal: "",
        acs: [{ ...EMPTY_AC }],
        nonGoals: "",
        maxIterations: 30,
        preauthorized: "",
        mechaStrategy,
        mechaAgents,
      },
      { save: false }
    );
    setAssistLog([]);
    setAssistTips([]);
    setRepairedPreview(null);
    setOutput("");
    setDraftNote("Draft cleared.");
    setShareNote("");
    setStatus("Draft cleared.");
  }

  function applyRepairs() {
    if (!repairedPreview) return;
    applyForm(
      {
        ...repairedPreview,
        mechaStrategy,
        mechaAgents,
      },
      { save: true, note: "Applied audit repairs to form" }
    );
    setStatus("Audit repairs applied to the work order. Review, then run again or hit MECHA.");
    track("repairs_applied");
    document.getElementById("work-order")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        applyForm(data.form, { save: true, note: "Draft saved from Grok" });
      }
      if (data.tips?.length) setAssistTips(data.tips);
      track("coach_filled", { tips: data.tips?.length || 0 });
      setAssistLog((log) => [
        ...log,
        { role: "assistant", text: data.reply || "Draft is in the form below. Tweak anything, then hit audit or MECHA." },
      ]);
      setStatus("Grok filled the work order. Scroll down, review it, then press.");
      setTimeout(() => document.getElementById("work-order")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
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
    "I put my agent task through The Wringer. Clear goal, real checks, honest verdict."
  )}&url=${encodeURIComponent("https://www.thewringer.ai")}`;

  const megaOn = mechaStrategy === "mega";
  const megaCents = megaPriceCents(mechaAgents);

  return (
    <main>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <span className="hero-kicker mono">Stop feeding agents mushy goals</span>
          <h1>
            The
            <br />
            <span className="red">Wringer</span>
          </h1>
          <p className="hero-sub">
            Talk to Grok. It builds a tight work order. Then hit it with a $1 stress test
            or a $10 multi-agent run that has to prove the result.
          </p>
          <div className="hero-ctas">
            <a className="btn-stamp" href="#coach">
              Chat with Grok
            </a>
            <a className="btn-outline" href="#how">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section className="steps" id="how">
        <div className="steps-inner">
          <div className="step">
            <div className="num">Step 01</div>
            <h3>Say it out loud</h3>
            <p>Describe the job like you would to a smart coworker. Grok fills goal, checks, and boundaries.</p>
          </div>
          <div className="step">
            <div className="num">Step 02</div>
            <h3>Pick the press</h3>
            <p>$1 Audit finds weak spots first. $10 MECHA Run actually does the work with a swarm and a reviewer.</p>
          </div>
          <div className="step">
            <div className="num">Step 03</div>
            <h3>Read the verdict</h3>
            <p>Grades, exit code, evidence chain. Honest failure beats fake SUCCESS every time.</p>
          </div>
        </div>
      </section>

      <section className="examples" id="examples">
        <div className="examples-inner">
          <h2>What you actually get</h2>
          <p className="examples-sub">Three tiers. Each does something different. Here is the real output from an operator-run case.</p>

          <div className="examples-grid">
            <div className="example-tier">
              <div className="example-tier-head">
                <span className="example-price">Free</span>
                <h3>Grok Coach</h3>
              </div>
              <p className="example-desc">
                Describe the job in plain English. Grok drafts a work order: goal, acceptance criteria, boundaries. 
                You get the contract shape without paying.
              </p>
              <div className="example-sample">
                <div className="example-label mono">Sample work order output</div>
                <pre className="example-pre">{`Goal: Confirm that Earth's daytime sky appears blue due to Rayleigh scattering

Acceptance Criteria:
[AUTO] Cite a peer-reviewed physics source defining Rayleigh scattering
[AUTO] Explain why shorter wavelengths scatter more than longer ones
[AUTO] State why the sky appears blue rather than violet

Boundaries: No discussion of sunsets, no other planets`}</pre>
              </div>
              <a className="btn-ghost example-cta" href="/verified">See full verified cases</a>
            </div>

            <div className="example-tier">
              <div className="example-tier-head">
                <span className="example-price">$1</span>
                <h3>Audit</h3>
              </div>
              <p className="example-desc">
                Stress-tests the work order itself. Finds vague checks, missing boundaries, unverifiable claims. 
                Returns a graded dry-run and a repaired contract.
              </p>
              <div className="example-sample">
                <div className="example-label mono">Sample audit verdict</div>
                <pre className="example-pre">{`<verdict>
  grade: A
  predicted_exit: 0 SUCCESS
  weakest_link: All criteria cite external sources; verification is possible.
  one_fix: Add a check for wavelength-dependent scattering intensity formula.
</verdict>

Repaired criteria:
[AUTO] Cite peer-reviewed source (Bohren & Clothiaux or equivalent)
[AUTO] State 1/wavelength^4 relationship for scattering intensity
[AUTO] Explain cone-cell sensitivity difference for blue vs violet`}</pre>
              </div>
              <a className="btn-ghost example-cta" href="/audit">How the audit works</a>
            </div>

            <div className="example-tier example-tier-feature">
              <div className="example-tier-head">
                <span className="example-price">$10+</span>
                <h3>MECHA Run</h3>
              </div>
              <p className="example-desc">
                Real sandbox execution. Multiple agents take the job. A reviewer picks or merges the best. 
                You get live telemetry, an exit code, the GAMMA HQ report, and an HD presentation.
              </p>
              <div className="example-sample">
                <div className="example-label mono">Sample MECHA telemetry</div>
                <pre className="example-pre">{`[BOOT] mecha-1788103355-4bd3f4 strategy=triumvirate
[FANOUT] triumvirate - 3 workers: Claude, Codex, Grok
[WORKER] Claude (claude) engaged
[WORKER] Codex (codex) engaged
[WORKER] Grok (xai) engaged
[WORKER] Grok answered
[WORKER] Codex answered
[WORKER] Claude answered
[REVIEW] Reviewer (Claude) judging 3 candidates
[REVIEW] Reviewer (Claude) verdict in
[DONE] cost=$0.7714 time=363.2s
[GAMMA] compiling HQ report (anthropic/claude-opus-4.1)
[GAMMA] HQ report ready · $0.3171 · 63.7s
[GAMMA] generating HD presentation
[GAMMA] HD presentation ready · 100.6s`}</pre>
              </div>
              <div className="example-sample">
                <div className="example-label mono">GAMMA HD presentation (operator example)</div>
                <div className="example-gallery">
                  <img 
                    src="/examples/gamma-example-cover.png" 
                    alt="GAMMA report cover slide showing exit status SUCCESS, reviewer confidence 0.9, winner Claude"
                    className="example-img"
                    loading="lazy"
                  />
                  <img 
                    src="/examples/gamma-example-content.png" 
                    alt="GAMMA report content slide explaining Rayleigh scattering mechanism with citations"
                    className="example-img"
                    loading="lazy"
                  />
                  <img 
                    src="/examples/gamma-example-refs.png" 
                    alt="GAMMA report references and conclusion slide"
                    className="example-img"
                    loading="lazy"
                  />
                </div>
                <p className="example-note">
                  This is a real operator-run MECHA case (sky-blue, triumvirate strategy). 
                  The HD presentation uses GPT Image 2 and takes about 3 minutes to generate.
                </p>
              </div>
              <a className="btn-ghost example-cta" href="/mecha">How MECHA runs work</a>
            </div>
          </div>

          <div className="examples-exit-codes">
            <h3>Exit codes explained</h3>
            <div className="exit-grid">
              <div className="exit-item">
                <span className="exit-code mono">EXIT 0 SUCCESS</span>
                <span className="exit-desc">Every acceptance criterion got real evidence. Rare and earned.</span>
              </div>
              <div className="exit-item">
                <span className="exit-code mono">EXIT 1 PARTIAL</span>
                <span className="exit-desc">Some criteria passed, some did not. Read what failed and why.</span>
              </div>
              <div className="exit-item">
                <span className="exit-code mono">EXIT 2 NEEDS_HUMAN</span>
                <span className="exit-desc">The run hit a check that requires human judgment.</span>
              </div>
              <div className="exit-item">
                <span className="exit-code mono">EXIT 3 STALLED</span>
                <span className="exit-desc">The swarm could not make progress. Contract may need work.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="coach" id="coach">
        <div className="coach-inner">
          <div className="coach-badge mono">Live coach</div>
          <h2>Chat with Grok</h2>
          <p className="coach-sub">Type the messy version. Grok writes the clean work order below. Edit anything before you pay.</p>
          <div className="coach-panel">
            <div className="coach-log" aria-live="polite">
              {assistLog.length === 0 && (
                <>
                  <div className="assist-bubble assistant">Hey. Tell me what you want done in normal words.</div>
                  <div className="assist-bubble assistant soft">
                    Try: &quot;I want a short weekly recap of my sales calls in a shared doc my team can open.&quot;
                  </div>
                  <div className="assist-bubble assistant soft">
                    Or: &quot;Turn my messy product notes into a simple launch checklist. Nothing gets marked done unless it really is.&quot;
                  </div>
                </>
              )}
              {assistLog.map((m, i) => (
                <div key={i} className={`assist-bubble ${m.role}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <form className="coach-form" onSubmit={runAssist}>
              <textarea
                value={assistMsg}
                onChange={(e) => setAssistMsg(e.target.value)}
                placeholder="What do you want help with?"
                rows={3}
                disabled={assistBusy || running}
              />
              <button className="btn-stamp" type="submit" disabled={assistBusy || running || !assistMsg.trim()}>
                {assistBusy ? <span className="blink">Grok is drafting...</span> : "Ask Grok to fill the form"}
              </button>
            </form>
            {(status || error) && (
              <div className={`status ${error ? "error" : ""} coach-status`}>{error || status}</div>
            )}
          </div>
        </div>
      </section>

      <section className="shop" id="work-order">
        <div className="ticket">
          <div className="ticket-head">
            <h2>Work Order</h2>
            <span className="no">REVIEW · EDIT · THEN PRESS</span>
          </div>
          <div className="draft-bar">
            <button type="button" className="btn-ghost" onClick={saveDraftNow} disabled={running}>
              Save draft
            </button>
            <button type="button" className="btn-ghost" onClick={copyShareLink} disabled={running}>
              Copy share link
            </button>
            <button type="button" className="btn-ghost" onClick={clearDraftNow} disabled={running}>
              Clear
            </button>
          </div>
          {(draftNote || shareNote) && (
            <div className="draft-notes">
              {draftNote && <p className="field-help">{draftNote}</p>}
              {shareNote && <p className="field-help mono share-link">{shareNote}</p>}
            </div>
          )}

          <label>Goal</label>
          <p className="field-help">One plain sentence. What does done look like?</p>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Customers can reset their password and get the email within a minute"
          />

          <label>How will we know it worked?</label>
          <p className="field-help">
            Simple pass or fail checks. &quot;Auto check&quot; if a computer can prove it. &quot;I&apos;ll look&quot; if a person has to confirm.
          </p>
          {acs.map((ac, i) => (
            <div className="ac-row" key={i}>
              <select value={ac.kind} onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, kind: e.target.value } : a)))}>
                <option value="AUTO">Auto check</option>
                <option value="HUMAN">I&apos;ll look</option>
              </select>
              <input
                value={ac.text}
                placeholder={
                  i === 0
                    ? "Reset email arrives and the new password lets me sign in"
                    : `Check ${i + 1}: something clear a stranger could verify`
                }
                onChange={(e) => setAcs(acs.map((a, j) => (j === i ? { ...a, text: e.target.value } : a)))}
              />
              <button className="btn-ghost" onClick={() => setAcs(acs.filter((_, j) => j !== i))} disabled={acs.length === 1}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => setAcs([...acs, { ...EMPTY_AC }])}>
            + Add check
          </button>

          <label>What should it not do?</label>
          <p className="field-help">Boundaries. Stops the agent from wandering.</p>
          <input
            value={nonGoals}
            onChange={(e) => setNonGoals(e.target.value)}
            placeholder="Don't redesign the site, don't change pricing, don't email real customers"
          />

          <label>How hard should it try?</label>
          <p className="field-help">How many attempts before it stops. Around 30 is fine for most jobs.</p>
          <input
            type="number"
            min="5"
            max="100"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value || "30", 10))}
          />

          <label>Anything risky you already allow?</label>
          <p className="field-help">Only if you want send, publish, delete, or charge. Leave blank for the safe lane.</p>
          <input
            value={preauthorized}
            onChange={(e) => setPreauthorized(e.target.value)}
            placeholder="Leave blank unless you mean it"
          />

          <div className="row">
            <button className="btn-ghost" onClick={compile}>
              Preview compiled contract
            </button>
            {contract && (
              <button className="btn-ghost" onClick={() => copy(buildPrompt(formState()), "Full protocol prompt")}>
                Copy full prompt
              </button>
            )}
          </div>
          {assistTips.length > 0 && (
            <ul className="tips">
              {assistTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
        </div>

        <aside className="tiers">
          <div className="tier">
            <div className="price">$1</div>
            <h3>The Audit</h3>
            <p>Stress-tests the work order itself. Finds weak checks and dry-runs the loop before you spend real agent time.</p>
            <button className="btn-stamp" onClick={() => wringerRun("audit")} disabled={running}>
              {running ? <span className="blink">In the wringer...</span> : "Audit work order - $1"}
            </button>
            <p className="promo-hint">Have a press pass code? Enter it at checkout.</p>
          </div>

          <div className="tier feature">
            <div className="price">{megaOn ? fmtUSD(megaCents) : "$10"}</div>
            <h3>MECHA Run</h3>
            <p>
              Real execution in a sandbox. Multiple agents take the same job. A reviewer picks or merges the best answer.
              You get the report and the proof.
            </p>
            <label>Strategy</label>
            <select value={mechaStrategy} onChange={(e) => setMechaStrategy(e.target.value)}>
              <option value="senate">senate - every backend answers, reviewer merges</option>
              <option value="triumvirate">triumvirate - Claude + Codex + Grok + reviewer</option>
              <option value="mega">mega - N agents across lineages, tournament judge</option>
              <option value="best-of-3">best-of-3 - three personas, reviewer picks</option>
              <option value="solo-claude">solo-claude - Claude at max thinking</option>
              <option value="solo-codex">solo-codex - Codex at max thinking</option>
              <option value="frontier-coder">frontier-coder - TDD: test, implement, review</option>
            </select>
            {megaOn && (
              <div className="mega-config">
                <label>
                  Agents - {mechaAgents} <span className="mono">({fmtUSD(megaCents)})</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="100"
                  value={mechaAgents}
                  onChange={(e) => setMechaAgents(parseInt(e.target.value, 10))}
                />
                <p className="promo-hint">
                  {mechaAgents} agents fan out, then a tournament reviewer collapses them. More agents is not always
                  better. Verification is the point. Min run stays $10.
                </p>
              </div>
            )}
            <div style={{ height: 16 }} />
            <button className="btn-stamp" onClick={() => wringerRun("mecha")} disabled={running}>
              {running ? (
                <span className="blink">MECHA engaged...</span>
              ) : megaOn ? (
                `MEGA MECHA Run - ${fmtUSD(megaCents)} · ${mechaAgents} agents`
              ) : (
                "Run with MECHA - $10"
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
                <li>
                  <strong>Repaired criteria</strong> means your checks were fuzzy. Keep the fixes unless they changed your intent.
                </li>
                <li>
                  <strong>Dry-run grades</strong> show whether the loop could even pretend to verify the work.
                </li>
                <li>If it says the goal is uncheckable, fix the form before a MECHA run.</li>
              </ul>
            </div>
            <div>
              <h3>MECHA Run ($10+)</h3>
              <ul>
                <li>
                  <strong>Exit 0 SUCCESS</strong> means every check got real evidence. Rare and earned.
                </li>
                <li>
                  <strong>PARTIAL / NEEDS_HUMAN / STALLED</strong> still helps. Read what failed and why.
                </li>
                <li>
                  <strong>Winner / candidates</strong> is the evidence chain. Open the winner first.
                </li>
                <li>
                  <strong>Model cost</strong> is LLM spend inside the sandbox, separate from your Wringer fee.
                </li>
              </ul>
            </div>
            <div>
              <h3>Good inputs look like</h3>
              <ul>
                <li>
                  Goal names a finished state: &quot;customers can reset passwords&quot;, not &quot;look at login stuff&quot;.
                </li>
                <li>Each check is something a stranger could prove without guessing.</li>
                <li>Boundaries stop surprise rewrites.</li>
                <li>Risky actions stay blank unless you truly want send, publish, or delete.</li>
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
            <p className="field-help">Live breadcrumbs from the sandbox.</p>
            <pre className="output">
              {mechaProgress
                .map((p) => {
                  if (p.kind === "run_start") return `[BOOT] ${p.run_id} strategy=${p.strategy}`;
                  if (p.kind === "strategy_start" && p.strategy === "mega")
                    return `[FANOUT] mega - ${p.agents ?? p.workers ?? (p.worker_list || []).length} agents${
                      p.concurrency ? `, ${p.concurrency}/wave` : ""
                    }${(p.lineages || []).length ? ` across ${(p.lineages || []).join(", ")}` : ""}`;
                  if (p.kind === "strategy_start")
                    return `[FANOUT] ${p.strategy} - ${p.workers ?? (p.worker_list || []).length} workers: ${(
                      p.worker_list || []
                    )
                      .map((w) => w.name)
                      .join(", ")}`;
                  if (p.kind === "worker_start") return `[WORKER] ${p.name} (${p.backend}) engaged`;
                  if (p.kind === "worker_done") return `[WORKER] ${p.name} ${p.error ? `FAILED: ${p.error}` : "answered"}`;
                  if (p.kind === "reviewer_start") return `[REVIEW] ${p.name} judging ${p.n_candidates} candidates`;
                  if (p.kind === "reviewer_done")
                    return `[REVIEW] ${p.name || "Reviewer"} ${p.error ? `FAILED: ${p.error}` : "verdict in"}`;
                  if (p.kind === "mega_layer_start")
                    return `[BRACKET] layer ${p.layer} - ${p.pods} judge pod${p.pods === 1 ? "" : "s"} over ${p.candidates} candidates`;
                  if (p.kind === "mega_pod_done")
                    return `[BRACKET] L${p.layer}.${p.pod} -> winner ${p.winner}${
                      p.confidence != null ? ` (conf ${p.confidence})` : ""
                    }`;
                  if (p.kind === "run_done")
                    return `[DONE] cost=$${Number(p.cost_usd || 0).toFixed(4)} time=${Number(p.elapsed_s || 0).toFixed(1)}s${
                      p.error ? ` error=${p.error}` : ""
                    }`;
                  if (p.kind === "gamma_start") return `[GAMMA] compiling HQ report (${p.model})`;
                  if (p.kind === "gamma_done")
                    return p.ok
                      ? `[GAMMA] HQ report ready · $${Number(p.cost_usd || 0).toFixed(4)} · ${Number(p.elapsed_s || 0).toFixed(1)}s`
                      : `[GAMMA] skipped: ${p.error}`;
                  if (p.kind === "gamma_presentation_start") return `[GAMMA] generating HD presentation`;
                  if (p.kind === "gamma_presentation_done")
                    return p.ok
                      ? `[GAMMA] HD presentation ready · ${Number(p.elapsed_s || 0).toFixed(1)}s`
                      : `[GAMMA] presentation skipped: ${p.error || "timeout"}`;
                  return `[${p.kind}] ${JSON.stringify({ ...p, ts: undefined, run_id: undefined })}`;
                })
                .join("\n")}
            </pre>
            {mechaReport && (
              <>
                <h2 style={{ marginTop: 22 }}>
                  MECHA Final Report - exit {mechaReport.exit_code} {mechaReport.exit_name}
                </h2>
                <div className="mecha-stats mono">
                  <span className="stat">strategy {mechaReport.strategy}</span>
                  <span className="stat">model cost ${Number(mechaReport.cost_usd || 0).toFixed(4)}</span>
                  <span className="stat">{Number(mechaReport.elapsed_s || 0).toFixed(1)}s</span>
                  {mechaReport.total_input_tokens || mechaReport.total_output_tokens ? (
                    <span className="stat">
                      {mechaReport.total_input_tokens || 0} tok in / {mechaReport.total_output_tokens || 0} tok out
                    </span>
                  ) : null}
                  {mechaReport.agents ? (
                    <span className="stat">
                      {mechaReport.succeeded ?? "?"}/{mechaReport.agents} agents survived
                    </span>
                  ) : null}
                  {mechaReport.layers ? <span className="stat">{mechaReport.layers} bracket layers</span> : null}
                  {mechaReport.run_id && <span className="stat">{mechaReport.run_id}</span>}
                </div>
                {mechaReport.gamma && (
                  <div className="verdict gamma">
                    <div className="verdict-head mono">GAMMA REPORT - HQ deliverable ({mechaReport.gamma_model})</div>
                    <pre className="output">{mechaReport.gamma}</pre>
                    <div className="row">
                      <button className="btn-ghost" onClick={() => copy(mechaReport.gamma, "GAMMA report")}>
                        Copy GAMMA report
                      </button>
                      {mechaReport.gamma_presentation_url && (
                        <a
                          href={mechaReport.gamma_presentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost"
                          style={{ textDecoration: "none" }}
                        >
                          View HD Presentation
                        </a>
                      )}
                      {mechaReport.gamma_export_url && (
                        <a
                          href={mechaReport.gamma_export_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost"
                          style={{ textDecoration: "none" }}
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {mechaReport.reviewer && (
                  <div className="verdict">
                    <div className="verdict-head mono">
                      {mechaReport.reviewer.name || "Reviewer"} verdict
                      {mechaReport.winner
                        ? ` - winner: candidate ${mechaReport.winner}${
                            mechaWinnerIdx >= 0 ? ` (${mechaReport.candidates[mechaWinnerIdx].name})` : ""
                          }`
                        : ""}
                      {mechaReport.confidence != null ? ` · confidence ${mechaReport.confidence}` : ""}
                    </div>
                    <pre className="output">{mechaReport.reviewer.text || mechaReport.reviewer.error || "(no reviewer output)"}</pre>
                  </div>
                )}
                <pre className="output">{mechaReport.report}</pre>
                {mechaReport.candidates?.length > 0 && (
                  <>
                    <h2 style={{ marginTop: 22 }}>Worker Candidates - full evidence chain</h2>
                    {mechaReport.candidates.map((c, i) => (
                      <details className="worker" key={i} open={mechaWinnerIdx === i}>
                        <summary className="mono">
                          {mechaWinnerIdx === i ? "★ " : ""}Candidate {i + 1} · {c.name} ({c.backend}){" "}
                          {c.error
                            ? `- FAILED: ${c.error}`
                            : `- ${c.output_tokens || 0} tok out · $${Number(c.cost_usd || 0).toFixed(4)} · ${Number(
                                c.elapsed_s || 0
                              ).toFixed(1)}s`}
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
                  <button className="btn-ghost" onClick={() => copy(mechaReport.report, "Final report")}>
                    Copy report
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => copy(JSON.stringify(mechaReport, null, 2), "Full run record (JSON)")}
                  >
                    Copy full run JSON
                  </button>
                  <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">
                    Share on X
                  </a>
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
            {repairedPreview && (
              <div className="repair-banner">
                <div>
                  <strong>Repairs ready.</strong> The auditor cleaned up the work order. One click puts them in the form.
                </div>
                <button type="button" className="btn-stamp" onClick={applyRepairs}>
                  Use audit repairs
                </button>
              </div>
            )}
            <pre className="output">{output}</pre>
            <div className="row">
              {repairedPreview && (
                <button type="button" className="btn-ghost" onClick={applyRepairs}>
                  Use audit repairs
                </button>
              )}
              <button className="btn-ghost" onClick={() => copy(output, "Verdict")}>
                Copy verdict
              </button>
              <a className="btn-ghost" style={{ textDecoration: "none", padding: "8px 14px" }} href={shareUrl} target="_blank" rel="noreferrer">
                Share on X
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="home-guides">
        <div className="faq-inner">
          <h2>Write work orders that verify</h2>
          <p className="home-guides-sub">
            Four short guides on the part of agent work everybody skips: the contract.
          </p>
          <div className="tpl-grid">
            <div className="tpl-card">
              <h3>Acceptance criteria for AI agents</h3>
              <p>Write checks a stranger can prove and an agent cannot fake.</p>
              <a className="btn-stamp" href="/guides/acceptance-criteria-for-ai-agents">
                Read
              </a>
            </div>
            <div className="tpl-card">
              <h3>Why AI agents need a dry run</h3>
              <p>Most failures are baked into the contract before the first tool call.</p>
              <a className="btn-stamp" href="/guides/why-ai-agents-need-a-dry-run">
                Read
              </a>
            </div>
            <div className="tpl-card">
              <h3>How to write an AI agent work order</h3>
              <p>Goal, checks, boundaries, budget. The four parts that matter.</p>
              <a className="btn-stamp" href="/guides/how-to-write-an-ai-agent-work-order">
                Read
              </a>
            </div>
            <div className="tpl-card">
              <h3>How to verify AI agent work</h3>
              <p>Do not trust the report. Re-run the checks and demand evidence.</p>
              <a className="btn-stamp" href="/guides/how-to-verify-ai-agent-work">
                Read
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="faq-inner">
          <h2>Questions people ask</h2>
          <div className="faq-list">
            {FAQS.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="footer">
        <div className="footer-sitemap">
          <a href="/audit">$1 Audit</a>
          <a href="/mecha">MECHA runs</a>
          <a href="/templates">Work order templates</a>
          <a href="/verified">Verified Wringers</a>
          <a href="/guides/acceptance-criteria-for-ai-agents">Acceptance criteria for AI agents</a>
          <a href="/guides/why-ai-agents-need-a-dry-run">Why agents need a dry run</a>
        </div>
        <p>
          Built by{" "}
          <a href="https://x.com/JoePro" target="_blank" rel="noreferrer">
            @JoePro
          </a>
          . One paid run, one honest verdict. The Wringer never fabricates a SUCCESS.
        </p>
      </div>
    </main>
  );
}
