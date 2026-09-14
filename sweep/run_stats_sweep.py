"""
Compute the unlabelled image statistics for the real clips and for every simulator
configuration, and rank the configurations by how close they sit to the real ones.

No labels and no training are involved, so this half of the study stands on its own
even if no model is ever trained.

    python run_stats_sweep.py --out=../data/stats_sweep.json
"""
import json
import os
import sys
import time
from pathlib import Path

from absl import app, flags
import numpy as np

HERE = Path(__file__).resolve().parent
REPO = Path(os.environ.get("DEEPTANGLE_ROOT", HERE.parent / "deeptangle"))
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(HERE))

import jax.random as jr  # noqa: E402
from skimage.io import imread  # noqa: E402

import celegans  # noqa: E402
import patch  # noqa: E402
import unlabelled_stats as us  # noqa: E402
from simconfig import SimConfig  # noqa: E402

flags.DEFINE_string("data", str(HERE.parent / "data" / "labeled_data"), "Real clips.")
flags.DEFINE_string("configs", str(HERE / "configs"), "Directory of SimConfig JSONs.")
flags.DEFINE_string("out", str(HERE.parent / "data" / "stats_sweep.json"), "Output.")
flags.DEFINE_integer("clips_per_density", 2, "Synthetic clips at each worm count.")
flags.DEFINE_integer("size", 256, "Frame size.")
flags.DEFINE_integer("nframes", 11, "Frames per clip.")
flags.DEFINE_integer("kpoints", 49, "Skeleton points.")
flags.DEFINE_float("clip_duration", 0.55, "Seconds per clip.")
flags.DEFINE_integer("seed", 0, "Seed.")
FLAGS = flags.FLAGS


def real_pool():
    dirs = sorted((Path(FLAGS.data) / "frames").iterdir())
    stats = []
    for d in dirs:
        frames = np.stack([imread(d / f"{i:02d}.png") for i in range(FLAGS.nframes)])
        stats.append(us.clip_stats(us.prepare_real_clip(frames)))
    return us.pool(stats), len(dirs)


def synthetic_pool(cfg, seed):
    patch.apply(cfg)
    key = jr.PRNGKey(seed)
    stats = []
    for nworms in us.DENSITY_LADDER:
        for _ in range(FLAGS.clips_per_density):
            key, sk, vk = jr.split(key, 3)
            w = celegans.simulate(sk, nworms, FLAGS.clip_duration, FLAGS.nframes,
                                  FLAGS.size, FLAGS.kpoints)
            clip = np.asarray(celegans.video_synthesis(vk, w, FLAGS.size))
            stats.append(us.clip_stats(us.prepare_synthetic_clip(clip)))
    return us.pool(stats)


# axis key, label, unit, the authors' own value on that axis.
# Worm length is reported as the midpoint of the drawn range, so the repo's
# uniform(30, 45) is 37.5 and not 30.
AXES = {
    "worm_length": ("Worm length", "px", 37.5),
    "body_radius": ("Body radius", "px", 0.8),
    "sensor_noise": ("Sensor noise", "std", 0.01),
    "drag_anisotropy": ("Drag anisotropy", "ratio", 4.0),
}


def classify(cfg):
    """Which axis a config moves, and the value it moves it to."""
    diff = cfg.diff_from_default()
    if not diff:
        return "defaults", None
    if "L_low" in diff or "L_high" in diff:
        return "worm_length", (cfg.L_low + cfg.L_high) / 2.0
    if "R" in diff:
        return "body_radius", cfg.R
    if "noise_std" in diff:
        return "sensor_noise", cfg.noise_std
    if "alpha_loc" in diff:
        return "drag_anisotropy", cfg.alpha_loc
    return "other", None


def main(argv):
    del argv
    t0 = time.time()
    print("measuring real clips, no labels used", flush=True)
    rp, n_real = real_pool()
    print(f"  {n_real} real frames in {time.time() - t0:.0f} s", flush=True)

    entries = []
    paths = sorted(Path(FLAGS.configs).glob("*.json"))

    # The repo's own settings, as the reference point every config departs from.
    for name, cfg, path in [("defaults", SimConfig(), None)] + [
        (p.stem, SimConfig.from_json(p), str(p)) for p in paths
    ]:
        t = time.time()
        sp = synthetic_pool(cfg, FLAGS.seed)
        dist, terms = us.distance(sp, rp)
        axis, value = classify(cfg)
        entries.append({
            "name": name,
            "config_path": path,
            "axis": axis,
            "axis_value": value,
            "settings_changed": cfg.diff_from_default(),
            "stat_distance_to_real": dist,
            "per_statistic_z": terms,
            "sim_stats": sp["mean"],
            "seconds": round(time.time() - t, 1),
        })
        print(f"  {name:12s} axis={axis:15s} distance={dist:6.3f}  "
              f"({time.time() - t:.0f} s)", flush=True)

    entries.sort(key=lambda e: e["stat_distance_to_real"])

    out = {
        "what": "unlabelled image statistics for the real clips and every simulator config",
        "no_labels_used": True,
        "real": {"frames": n_real, "stats": rp["mean"], "spread": rp["sd"]},
        "statistics": us.STAT_KEYS,
        "density_ladder": list(us.DENSITY_LADDER),
        "distance": "mean absolute z-score against the spread across real frames",
        "ranking_best_first": [e["name"] for e in entries],
        "configs": entries,
        "total_seconds": round(time.time() - t0, 1),
    }
    Path(FLAGS.out).parent.mkdir(parents=True, exist_ok=True)
    with open(FLAGS.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwrote {FLAGS.out} in {out['total_seconds']} s")
    print("closest to real first:", ", ".join(out["ranking_best_first"][:6]))


if __name__ == "__main__":
    app.run(main)
