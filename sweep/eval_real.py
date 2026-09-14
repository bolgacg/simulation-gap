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
flags.DEFINE_integer("limit", 0, "Score only the first N sections. 0 means all of them.")
flags.DEFINE_string("only_density", None, "Restrict to one video density, for example 13x or 1_5x.")
flags.DEFINE_string(
    "labelling_check",
    None,
    "Path to labelling_check.json. Its label_region gives the disc the humans "
    "actually annotated, and scoring is additionally reported restricted to it.",
)
flags.DEFINE_float("region_radius", 0.0, "Override the region radius in px. 0 uses the file.")
flags.DEFINE_string("region_centre", None, "Override the region centre as 'x,y'.")
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
        # The model's head/tail orientation is arbitrary: train.py's loss takes the
        # minimum over the label and its reverse. asymmetric_dtw walks the label
        # monotonically along the prediction, so a reversed prediction scores as a
        # miss unless the same flip is tried here.
        b_flip = b[::-1].copy()
        best, best_i = np.inf, -1
        for i in near:
            d = min(asymmetric_dtw(curves[i], b), asymmetric_dtw(curves[i], b_flip))
            if d < best:
                best, best_i = d, int(i)
        out.append((best, best_i))
    return out


def load_region():
    """
    The disc the annotators actually worked in.

    97 percent of hand-clicked points sit inside a disc of radius 72 px centred at
    (113, 116), which is a quarter of the 256 px frame. Detections are made over the
    whole frame, so a correct detection outside that disc has no label it could ever
    match and is counted as a false positive. Scoring restricted to the disc is the
    only way precision means anything; recall is unaffected either way.
    """
    centre, radius = None, None
    if FLAGS.labelling_check:
        with open(FLAGS.labelling_check) as f:
            lr = json.load(f).get("label_region", {})
        centre = lr.get("centre_of_labelled_region")
        radius = lr.get("hard_radius_px")
    if FLAGS.region_centre:
        centre = [float(v) for v in FLAGS.region_centre.split(",")]
    if FLAGS.region_radius > 0:
        radius = FLAGS.region_radius
    if centre is None or radius is None:
        return None
    return {"centre_px": [float(centre[0]), float(centre[1])], "radius_px": float(radius)}


def inside(points, region):
    """points is (..., 2); returns a boolean mask."""
    cx, cy = region["centre_px"]
    d2 = (points[..., 0] - cx) ** 2 + (points[..., 1] - cy) ** 2
    return d2 <= region["radius_px"] ** 2


def main(argv):
    del argv
    data = Path(FLAGS.data)
    with open(data / "labels.json") as f:
        labels_all = json.load(f)

    region = load_region()
    if region:
        logging.info("scoring also restricted to disc %s", region)

    with dt.time_activity("Loading model"):
        forward_fn, state = dt.load_model(FLAGS.model)

    n_lab = n_found = n_pred = n_claimed = 0
    r_lab = r_found = r_pred = r_claimed = 0
    per_section = {}
    dists = []

    names = sorted(labels_all)
    if FLAGS.only_density:
        tag = f"WS0001-D3-{FLAGS.only_density}"
        names = [n for n in names if n.startswith(tag)]
    if FLAGS.limit:
        names = names[: FLAGS.limit]

    for name in names:
        entry = labels_all[name]
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

        sec = {
            "labels": len(labels), "found": found,
            "predictions": int(len(preds.w)), "claimed": claimed,
        }

        if region and len(preds.w):
            # A label counts if its midpoint is in the disc, a prediction if the
            # midpoint of its centreline is. Same rule on both sides.
            curves = np.asarray(preds.w[:, 1])
            pred_in = inside(curves[:, curves.shape[1] // 2, :], region)
            lab_in = [bool(inside(lab[len(lab) // 2], region)) for lab in labels]

            rl = sum(lab_in)
            rf = sum(
                1 for (d, i), ok in zip(scored, lab_in)
                if ok and d <= FLAGS.dtw_cutoff and i >= 0 and pred_in[i]
            )
            rc = len({
                i for (d, i), ok in zip(scored, lab_in)
                if ok and d <= FLAGS.dtw_cutoff and i >= 0 and pred_in[i]
            })
            r_lab += rl
            r_found += rf
            r_pred += int(pred_in.sum())
            r_claimed += rc
            sec.update({
                "region_labels": rl, "region_found": rf,
                "region_predictions": int(pred_in.sum()), "region_claimed": rc,
            })

        per_section[name] = sec

    result = {
        "model": FLAGS.model,
        "preprocess": FLAGS.preprocess,
        "dtw_cutoff": FLAGS.dtw_cutoff,
        "score_threshold": FLAGS.score_threshold,
        "overlap_threshold": FLAGS.overlap_threshold,
        "labels": n_lab,
        "found": n_found,
        "recall": n_found / n_lab if n_lab else 0.0,
        "predictions": n_pred,
        "precision": n_claimed / n_pred if n_pred else 0.0,
        "median_adtw_px": float(np.median(dists)) if dists else None,
        "region": region,
        "region_labels": r_lab if region else None,
        "region_found": r_found if region else None,
        "region_recall": (r_found / r_lab if r_lab else 0.0) if region else None,
        "region_predictions": r_pred if region else None,
        "region_precision": (r_claimed / r_pred if r_pred else 0.0) if region else None,
        "per_section": per_section,
    }
    print(json.dumps({k: v for k, v in result.items() if k != "per_section"}, indent=2))
    if FLAGS.out:
        Path(FLAGS.out).parent.mkdir(parents=True, exist_ok=True)
        with open(FLAGS.out, "w") as f:
            json.dump(result, f, indent=2)


if __name__ == "__main__":
    app.run(main)
