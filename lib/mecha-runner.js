// Bash runner executed inside the Daytona sandbox. Unpacks the vendored MECHA
// orchestrator, runs `mecha solve` against the compiled contract, then distills
// the event log + final answer into report.json for the status endpoint.
export const RUNNER_SOURCE = `#!/bin/bash
set -u
cd "$RUN_DIR"
base64 -d mecha.tar.gz.b64 > mecha.tar.gz
tar xzf mecha.tar.gz
mkdir -p work
python3 mecha/scripts/mecha.py solve \\
  --task "$(cat task.txt)" \\
  --strategy "$STRATEGY" \\
  --thinking high \\
  --workspace work \\
  --no-openclaw \\
  --no-include-files \\
  --write-to final.md \\
  --per-worker-timeout "\${PER_WORKER_TIMEOUT:-480}" \\
  --total-fanout-timeout "\${FANOUT_TIMEOUT:-600}" \\
  > mecha.log 2>&1
export MECHA_EXIT=$?
python3 - <<'PY'
import json, os
run_dir = os.environ["RUN_DIR"]
final = ""
try:
    final = open(run_dir + "/final.md", encoding="utf-8").read()
except Exception:
    pass
events = []
try:
    for line in open(run_dir + "/mecha/state/events.jsonl", encoding="utf-8"):
        try:
            events.append(json.loads(line))
        except Exception:
            pass
except Exception:
    pass
done = [e for e in events if e.get("kind") == "run_done"]
cost = done[-1].get("cost_usd", 0) if done else 0
elapsed = done[-1].get("elapsed_s", 0) if done else 0
err = done[-1].get("error") if done else None
exit_code = int(os.environ.get("MECHA_EXIT", "1"))
log_tail = ""
if not final:
    try:
        log_tail = open(run_dir + "/mecha.log", encoding="utf-8").read()[-2000:]
    except Exception:
        pass

# Full run record (candidates, reviewer verdict, token counts) saved by mecha
run_data = {}
try:
    import glob
    runs = sorted(glob.glob(run_dir + "/mecha/state/runs/*/run.json"), key=os.path.getmtime)
    if runs:
        run_data = json.load(open(runs[-1], encoding="utf-8"))
except Exception:
    pass

CAP = 60000
candidates = []
for c in run_data.get("candidates") or []:
    candidates.append({
        "name": c.get("name"),
        "backend": c.get("backend"),
        "error": c.get("error"),
        "input_tokens": c.get("input_tokens", 0),
        "output_tokens": c.get("output_tokens", 0),
        "cost_usd": c.get("cost_usd", 0),
        "elapsed_s": c.get("elapsed_s", 0),
        "text": (c.get("text") or "")[:CAP],
    })
rev = run_data.get("reviewer") or None
reviewer = None
if rev:
    reviewer = {
        "name": rev.get("name"),
        "backend": rev.get("backend"),
        "error": rev.get("error"),
        "cost_usd": rev.get("cost_usd", 0),
        "elapsed_s": rev.get("elapsed_s", 0),
        "text": (rev.get("text") or "")[:CAP],
    }
notes = run_data.get("notes") or {}

# Files the workers produced in the workspace
artifacts = []
try:
    work = run_dir + "/work"
    for root, dirs, files in os.walk(work):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        if len(artifacts) >= 20:
            break
        for fn in sorted(files):
            fp = os.path.join(root, fn)
            try:
                if os.path.getsize(fp) > 50000:
                    continue
                content = open(fp, encoding="utf-8", errors="replace").read()
            except Exception:
                continue
            artifacts.append({"path": os.path.relpath(fp, work), "content": content})
            if len(artifacts) >= 20:
                break
except Exception:
    pass

report = {
    "exit_code": exit_code,
    "exit_name": "SUCCESS" if exit_code == 0 and final else "ERROR",
    "report": final or ("(no final answer)\\n" + log_tail),
    "cost_usd": cost,
    "elapsed_s": elapsed,
    "strategy": os.environ.get("STRATEGY", ""),
    "error": err,
    "run_id": run_data.get("run_id"),
    "candidates": candidates,
    "reviewer": reviewer,
    "winner": notes.get("winner"),
    "confidence": notes.get("confidence"),
    "total_input_tokens": sum(c["input_tokens"] or 0 for c in candidates),
    "total_output_tokens": sum(c["output_tokens"] or 0 for c in candidates),
    "artifacts": artifacts,
}
open(run_dir + "/report-base.json", "w", encoding="utf-8").write(json.dumps(report))
PY
python3 - <<'PY'
import json, os, time, urllib.request

# GAMMA report: a top model turns the raw run record into an executive-grade
# deliverable. Failure-tolerant — the raw report stands on its own.
run_dir = os.environ["RUN_DIR"]
key = os.environ.get("OPENROUTER_API_KEY", "")
model = os.environ.get("GAMMA_MODEL", "anthropic/claude-opus-4.1")
def emit(kind, **kw):
    try:
        with open(run_dir + "/mecha/state/events.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"kind": kind, **kw}) + "\\n")
    except Exception:
        pass

report = json.load(open(run_dir + "/report-base.json", encoding="utf-8"))
if not key:
    open(run_dir + "/report.json", "w", encoding="utf-8").write(json.dumps(report))
    raise SystemExit(0)
task = ""
try:
    task = open(run_dir + "/task.txt", encoding="utf-8").read()[:8000]
except Exception:
    pass
cand_lines = []
for c in report.get("candidates") or []:
    cand_lines.append(
        f"--- {c.get('name')} ({c.get('backend')}) error={c.get('error')} "
        f"out_tokens={c.get('output_tokens')} cost=\${c.get('cost_usd',0):.4f} ---\\n"
        + (c.get("text") or "")[:12000]
    )
rev = report.get("reviewer") or {}
prompt = f"""You are GAMMA, the final-stage analyst of a multi-agent execution system called The Wringer.
A customer paid for a MECHA Run: several frontier agents independently attempted their task and a reviewer judged the candidates.
Produce the definitive, high-quality deliverable report in Markdown. Requirements:
- Start with '# GAMMA REPORT' then a one-paragraph executive summary in plain language.
- '## Verdict' — what was achieved, exit status ({report.get('exit_name')}), reviewer's winner and confidence, and YOUR independent assessment of whether the winning answer actually satisfies the acceptance criteria.
- '## The Deliverable' — present the best final work product (code/files/answer) cleaned up and ready to use. Fix obvious gaps or bugs you can see; note every change you make.
- '## Verification' — exactly how the customer can verify it themselves (commands, expected output). Be explicit about what was and was NOT verified during the run.
- '## Candidate Analysis' — brief honest comparison of each worker's attempt, including failures.
- '## Risks & Next Steps' — concrete, prioritized.
Be brutally honest; never fabricate success. Quality bar: the customer should think this alone was worth the price.

THE TASK:
{task}

FINAL ANSWER (reviewer-selected):
{(report.get('report') or '')[:15000]}

REVIEWER VERDICT (winner={report.get('winner')}, confidence={report.get('confidence')}):
{(rev.get('text') or '')[:6000]}

CANDIDATES:
{chr(10).join(cand_lines)[:40000]}
"""
payload = {
    "model": model,
    "messages": [{"role": "user", "content": prompt}],
    "temperature": 0.4,
    "max_tokens": 16000,
    "usage": {"include": True},
}
req = urllib.request.Request(
    "https://openrouter.ai/api/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}", "X-Title": "The Wringer GAMMA"},
    method="POST",
)
start = time.time()
emit("gamma_start", model=model)
try:
    with urllib.request.urlopen(req, timeout=420) as r:
        data = json.loads(r.read().decode("utf-8"))
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    report["gamma"] = text
    report["gamma_model"] = model
    report["gamma_cost_usd"] = float(usage.get("cost", 0) or 0)
    report["gamma_elapsed_s"] = round(time.time() - start, 1)
    emit("gamma_done", ok=True, cost_usd=report["gamma_cost_usd"], elapsed_s=report["gamma_elapsed_s"])
    open(run_dir + "/report.json", "w", encoding="utf-8").write(json.dumps(report))
except Exception as e:
    report["gamma_error"] = str(e)[:300]
    emit("gamma_done", ok=False, error=report["gamma_error"])
    open(run_dir + "/report.json", "w", encoding="utf-8").write(json.dumps(report))
PY
[ -f "$RUN_DIR/report.json" ] || cp "$RUN_DIR/report-base.json" "$RUN_DIR/report.json"
`;

export const MECHA_STRATEGIES = [
  "senate",
  "triumvirate",
  "best-of-3",
  "solo-claude",
  "solo-codex",
  "frontier-coder",
];
