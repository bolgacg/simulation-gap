"""
Score a trained deeptangle checkpoint against the hand-labelled real clips.

Data is Zenodo 8093305 labeled_data.zip: 178 clips of 11 frames at 256x256, with
labels.json giving hand-clicked centrelines for the middle frame (05.png) only.

The metric is the paper's own: asymmetric dynamic time warping from
deeptangle/metrics.py, which walks the sparse human points along the dense
predicted centreline, with the paper's cutoff of 3.0 px for a correct detection.

    python eval_real.py --model=runs/baseline/<uid> --data=../data/labeled_data \
        --out=runs/baseline/real_score.json

Nothing here writes into the deeptangle clone.
"""
import json
import os
import sys
from pathlib import Path

from absl import app, flags, logging
import numpy as np

# scikit-video uses deprecated numpy aliases, same shim as examples/detect.py
np.float = np.float64  # type: ignore[attr-defined]
np.int = np.int_  # type: ignore[attr-defined]

import deeptangle as dt
from deeptangle.metrics import asymmetric_dtw
from skimage.exposure import equalize_adapthist
from skimage.io import imread

flags.DEFINE_string("model", None, "Checkpoint directory.", required=True)
flags.DEFINE_string("data", "../data/labeled_data", "Extracted labeled_data directory.")
flags.DEFINE_string("out", None, "Where to write the JSON result.")
flags.DEFINE_float("correction_factor", 1.2, "Intensity scaling after CLAHE, as in detect.py.")
flags.DEFINE_float("score_threshold", 0.5, "Confidence threshold.")
flags.DEFINE_float("overlap_threshold", 0.5, "Latent-space NMS threshold.")
flags.DEFINE_float("dtw_cutoff", 3.0, "aDTW distance in px below which a label counts as found.")
flags.DEFINE_integer("centroid_gate", 60, "Skip prediction/label pairs further apart than this, px.")
flags.DEFINE_string("preprocess", "clahe", "clahe (as detect.py) or percentile (as training).")
FLAGS = flags.FLAGS


def load_clip(section_dir: Path) -> np.ndarray:
    frames = [imread(section_dir / f"{i:02d}.png") for i in range(11)]
    return np.stack(frames).astype(np.float32)


def preprocess(clip: np.ndarray) -> np.ndarray:
    clip = 255.0 - clip
    if FLAGS.preprocess == "clahe":
        # detect.py feeds equalize_adapthist the uint8 stack straight from the video,
        # and it CLAHEs the 11 frames as one 3D volume. Keep both.
        clip = equalize_adapthist(np.clip(clip, 0, 255).astype(np.uint8))
        clip = FLAGS.correction_factor * clip
    else:
        lo, hi = np.percentile(clip, 1), np.percentile(clip, 99)
        clip = (clip - lo) / (hi - lo)
    return clip[None, ...].astype(np.float32)


def score_section(preds_w, labels):
    """Best aDTW per label, plus which prediction claimed it."""
    if len(preds_w) == 0:
        return [(np.inf, -1) for _ in labels]
    # middle temporal slice, (npred, kpoints, 2)
    curves = np.asarray(preds_w[:, 1], dtype=np.float64)
    centres = curves[:, curves.shape[1] // 2, :]

    out = []
    for lab in labels:
        b = np.asarray(lab, dtype=np.float64)
        if len(b) < 2 or len(b) >= curves.shape[1]:
            out.append((np.inf, -1))
            continue
        lc = b.mean(axis=0)
        near = np.nonzero(np.sum((centres - lc) ** 2, axis=1) < FLAGS.centroid_gate ** 2)[0]
        best, best_i = np.inf, -1
        for i in near:
            d = asymmetric_dtw(curves[i], b)
            if d < best:
                best, best_i = d, int(i)
        out.append((best, best_i))
    return out


def main(argv):
    del argv
    data = Path(FLAGS.data)
    with open(data / "labels.json") as f:
        labels_all = json.load(f)

    with dt.time_activity("Loading model"):
        forward_fn, state = dt.load_model(FLAGS.model)

    n_lab = n_found = n_pred = n_claimed = 0
    per_section = {}
    dists = []

    for name, entry in sorted(labels_all.items()):
        section = data / "frames" / name
        if not section.is_dir():
            logging.warning("missing frames for %s, skipping", name)
            continue
        clip = preprocess(load_clip(section))
        preds = dt.detect(
            forward_fn, state, clip,
            threshold=FLAGS.score_threshold,
            overlap_threshold=FLAGS.overlap_threshold,
        )
        labels = [np.stack([s["x"], s["y"]], axis=-1) for s in entry["splines"]]
        scored = score_section(preds.w, labels)

        found = sum(1 for d, _ in scored if d <= FLAGS.dtw_cutoff)
        claimed = len({i for d, i in scored if d <= FLAGS.dtw_cutoff and i >= 0})
        n_lab += len(labels)
        n_found += found
        n_pred += len(preds.w)
        n_claimed += claimed
        dists += [d for d, _ in scored if np.isfinite(d)]
        per_section[name] = {
            "labels": len(labels), "found": found,
            "predictions": int(len(preds.w)), "claimed": claimed,
        }

    result = {
        "model": FLAGS.model,
        "preprocess": FLAGS.preprocess,
        "dtw_cutoff": FLAGS.dtw_cutoff,
        "labels": n_lab,
        "found": n_found,
        "recall": n_found / n_lab if n_lab else 0.0,
        "predictions": n_pred,
        "precision": n_claimed / n_pred if n_pred else 0.0,
        "median_adtw_px": float(np.median(dists)) if dists else None,
        "per_section": per_section,
    }
    print(json.dumps({k: v for k, v in result.items() if k != "per_section"}, indent=2))
    if FLAGS.out:
        Path(FLAGS.out).parent.mkdir(parents=True, exist_ok=True)
        with open(FLAGS.out, "w") as f:
            json.dump(result, f, indent=2)


if __name__ == "__main__":
    app.run(main)
