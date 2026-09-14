"""
What an undertrained model does as the confidence threshold is lowered.

Scoring a checkpoint at the published operating point (score_threshold 0.5) can read
exactly zero, which invites the reading "the model learned nothing". That is not quite
right and the difference matters. Lowering the threshold recovers some recall, but by
emitting tens of predictions per label, and the localisation stays far worse than the
published model's half-pixel median. This script records recall, precision and median
distance across thresholds so the claim rests on numbers.

    python threshold_sweep.py --model=runs/defaults/seg4/<uid> --out=../data/threshold.json
"""
import json
import subprocess
import sys
from pathlib import Path

from absl import app, flags

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

flags.DEFINE_string("model", None, "Checkpoint directory.", required=True)
flags.DEFINE_string("out", str(ROOT / "data" / "threshold_sweep.json"), "Output.")
flags.DEFINE_integer("limit", 40, "Clips to score at each threshold.")
flags.DEFINE_string("label", "defaults at 800 steps", "What this checkpoint is.")
flags.DEFINE_list("thresholds", ["0.5", "0.2", "0.1", "0.05", "0.02", "0.01"], "Thresholds.")
FLAGS = flags.FLAGS


def run_one(th):
    cmd = [
        sys.executable, str(HERE / "eval_real.py"),
        f"--model={FLAGS.model}",
        f"--data={ROOT / 'data' / 'labeled_data'}",
        f"--labelling_check={ROOT / 'data' / 'labelling_check.json'}",
        f"--limit={FLAGS.limit}",
        f"--score_threshold={th}",
        "--max_predictions=800",
        f"--out=/tmp/thr_{th}.json",
    ]
    env = {"PYTHONPATH": str(ROOT / "deeptangle"), "PATH": "/usr/bin:/bin"}
    subprocess.run(cmd, env=env, capture_output=True, timeout=3600)
    return json.loads(Path(f"/tmp/thr_{th}.json").read_text())


def main(argv):
    del argv
    rows = []
    for th in FLAGS.thresholds:
        d = run_one(th)
        rows.append({
            "score_threshold": float(th),
            "labels": d["labels"],
            "found": d["found"],
            "recall": d["recall"],
            "predictions": d["predictions"],
            "precision": d["precision"],
            "predictions_per_label": (d["predictions"] / d["labels"]) if d["labels"] else None,
            "median_adtw_px": d["median_adtw_px"],
            "cap_bound_on_clips": d.get("cap_bound_on_clips"),
        })
        r = rows[-1]
        print("th=%-5s recall=%.4f precision=%.4f preds/label=%6.1f median=%s cap_bound=%s"
              % (th, r["recall"], r["precision"], r["predictions_per_label"] or 0,
                 ("%.2f" % r["median_adtw_px"]) if r["median_adtw_px"] else "none",
                 r["cap_bound_on_clips"]), flush=True)

    out = {
        "what": FLAGS.label,
        "model": FLAGS.model,
        "clips_scored": FLAGS.limit,
        "max_predictions": 800,
        "note": "a cap of 800 candidates per clip is applied so the low thresholds can be "
                "scored at all; where cap_bound_on_clips is non-zero the recall is a lower "
                "bound and the prediction count is a floor.",
        "rows": rows,
    }
    Path(FLAGS.out).write_text(json.dumps(out, indent=2))
    print("wrote", FLAGS.out)


if __name__ == "__main__":
    app.run(main)
