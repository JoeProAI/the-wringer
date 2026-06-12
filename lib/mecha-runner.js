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
  --per-worker-timeout "\${PER_WORKER_TIMEOUT:-240}" \\
  --total-fanout-timeout "\${FANOUT_TIMEOUT:-360}" \\
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
report = {
    "exit_code": exit_code,
    "exit_name": "SUCCESS" if exit_code == 0 and final else "ERROR",
    "report": final or ("(no final answer)\\n" + log_tail),
    "cost_usd": cost,
    "elapsed_s": elapsed,
    "strategy": os.environ.get("STRATEGY", ""),
    "error": err,
}
open(run_dir + "/report.json", "w", encoding="utf-8").write(json.dumps(report))
PY
`;

export const MECHA_STRATEGIES = [
  "senate",
  "triumvirate",
  "best-of-3",
  "solo-claude",
  "solo-codex",
  "frontier-coder",
];
