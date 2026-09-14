"""
One training run of deeptangle with a chosen simulator configuration.

Takes every flag train.py takes, plus --simconfig pointing at a SimConfig JSON.
With no --simconfig it is exactly train.py.

    python sweep_run.py --simconfig=configs/short_worms.json \
        --train_steps=2000 --batch_size=4 --checkpoint_dir=runs/short_worms --save

This file must not have "train" in its path: deeptangle/logger.py picks the flag
module to record by substring matching on "train", and a second matching module
would shadow train.py's own flags in experiment.json.
"""
import json
import os
import sys
from pathlib import Path

from absl import app, flags, logging

HERE = Path(__file__).resolve().parent
REPO = Path(os.environ.get("DEEPTANGLE_ROOT", HERE.parent / "deeptangle"))
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(HERE))

import train  # noqa: E402  registers train.py's flags

import patch  # noqa: E402
from simconfig import SimConfig  # noqa: E402

flags.DEFINE_string("simconfig", None, "Path to a SimConfig JSON. Omit for repo defaults.")
FLAGS = flags.FLAGS


def main(argv):
    cfg = SimConfig.from_json(FLAGS.simconfig) if FLAGS.simconfig else SimConfig()
    patch.apply(cfg, also_patch=(train,))

    diff = cfg.diff_from_default()
    logging.info("simulator config: %s", FLAGS.simconfig or "repo defaults")
    logging.info("differs from repo defaults in: %s", json.dumps(diff) if diff else "nothing")

    outdir = Path(FLAGS.checkpoint_dir).resolve()
    if FLAGS.save:
        outdir.mkdir(parents=True, exist_ok=True)
        cfg.to_json(outdir / "simconfig.json")
    FLAGS.checkpoint_dir = str(outdir)

    # deeptangle/logger.py records the code version with `git rev-parse HEAD`, which
    # reads the working directory, so training has to run from inside the clone.
    # Every path the run touches is absolute by this point.
    os.chdir(REPO)
    train.main(argv)


if __name__ == "__main__":
    app.run(main)
