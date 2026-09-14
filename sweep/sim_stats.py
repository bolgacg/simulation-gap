"""
Measure a synthetic clip the same way the real clips were measured, so the two
sets of numbers are comparable.

Real clips were measured after `255 - x` inversion and 1st/99th percentile
normalisation. Synthetic clips are already bright-on-dark, so only the
normalisation is applied here.

    python sim_stats.py --nworms=50 --clips=8
    python sim_stats.py --nworms=50 --clips=8 --simconfig=configs/thin_worms.json
"""
import json
import os
import sys
from pathlib import Path

from absl import app, flags
import numpy as np

HERE = Path(__file__).resolve().parent
REPO = Path(os.environ.get("DEEPTANGLE_ROOT", HERE.parent / "deeptangle"))
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(HERE))

import jax  # noqa: E402
import jax.random as jr  # noqa: E402
import celegans  # noqa: E402
import patch  # noqa: E402
from simconfig import SimConfig  # noqa: E402

flags.DEFINE_string("simconfig", None, "Path to a SimConfig JSON.")
flags.DEFINE_integer("nworms", 50, "Worms per clip.")
flags.DEFINE_integer("clips", 8, "Number of clips to average over.")
flags.DEFINE_integer("size", 256, "Frame size.")
flags.DEFINE_integer("nframes", 11, "Frames per clip.")
flags.DEFINE_integer("kpoints", 49, "Skeleton points.")
flags.DEFINE_float("clip_duration", 0.55, "Seconds per clip.")
flags.DEFINE_integer("seed", 0, "Seed.")
FLAGS = flags.FLAGS


def normalise(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return (a - lo) / (hi - lo)


def profile_width(img, curve):
    """FWHM of the intensity profile across the body at its midpoint."""
    i = len(curve) // 2
    tx, ty = curve[i + 1] - curve[i - 1]
    n = np.hypot(tx, ty)
    if n == 0:
        return None
    nx, ny = -ty / n, tx / n
    ts = np.linspace(-5, 5, 101)
    px = curve[i, 0] + nx * ts
    py = curve[i, 1] + ny * ts
    ok = (px >= 0) & (px < img.shape[1] - 1) & (py >= 0) & (py < img.shape[0] - 1)
    if ok.sum() < 60:
        return None
    px, py, ts = px[ok], py[ok], ts[ok]
    x0, y0 = np.floor(px).astype(int), np.floor(py).astype(int)
    fx, fy = px - x0, py - y0
    v = (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy)
         + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)
    base = np.percentile(v, 10)
    peak = v.max()
    if peak - base < 0.05:
        return None
    above = ts[v >= base + 0.5 * (peak - base)]
    return float(above.max() - above.min()) if len(above) >= 2 else None


def main(argv):
    del argv
    cfg = SimConfig.from_json(FLAGS.simconfig) if FLAGS.simconfig else SimConfig()
    patch.apply(cfg)

    key = jr.PRNGKey(FLAGS.seed)
    widths, fgs, sds, lengths = [], [], [], []

    for c in range(FLAGS.clips):
        key, sk, vk = jr.split(key, 3)
        w = celegans.simulate(sk, FLAGS.nworms, FLAGS.clip_duration, FLAGS.nframes,
                              FLAGS.size, FLAGS.kpoints)
        clip = celegans.video_synthesis(vk, w, FLAGS.size)
        mid = FLAGS.nframes // 2
        img = normalise(np.asarray(clip[mid], dtype=np.float64))
        coords = np.asarray(w[mid], dtype=np.float64)  # (nworms, kpoints, 2)

        fgs.append(float((img > 0.5).mean()))
        sds.append(float(np.asarray(clip[mid]).std()))
        for curve in coords:
            lengths.append(float(np.sum(np.hypot(*np.diff(curve, axis=0).T))))
            ww = profile_width(img, curve)
            if ww is not None:
                widths.append(ww)

    widths = np.array(widths)
    lengths = np.array(lengths)
    out = {
        "simconfig": FLAGS.simconfig or "repo defaults",
        "differs_from_default": cfg.diff_from_default(),
        "nworms": FLAGS.nworms,
        "clips": FLAGS.clips,
        "centreline_length_px": {
            "median": float(np.median(lengths)), "mean": float(lengths.mean()),
            "p5": float(np.percentile(lengths, 5)), "p95": float(np.percentile(lengths, 95)),
        },
        "body_fwhm_px": {
            "median": float(np.median(widths)), "mean": float(widths.mean()),
            "p5": float(np.percentile(widths, 5)), "p95": float(np.percentile(widths, 95)),
            "n": int(len(widths)),
        },
        "foreground_fraction_above_half": float(np.mean(fgs)),
        "raw_pixel_sd": float(np.mean(sds)),
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    app.run(main)
