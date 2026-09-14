# simulation-gap: setup log

Purpose: make Kirkegaard's deeptangle trainable on the machine `gene`, so a sweep over
simulator settings can be run and each setting scored against real microscopy data.

Date started: 14 Sep 2026.

## What exists where

| Path | What |
|---|---|
| `/home/bolgac/projects/simulation-gap/deeptangle` | clone of github.com/kirkegaardlab/deeptangle, commit 7c9775d, read-only, never pushed |
| `/home/bolgac/projects/simulation-gap/data/labeled_data.zip` | Zenodo 8093305 labelled real clips, 57.5 MB, CC-BY-4.0 |
| `/home/bolgac/projects/simulation-gap/data/labeled_data/` | extracted `labels.json` and `plot_data.py` |
| `gene:/home/bo/simulation-gap/deeptangle` | rsync copy of the repo without `.git`, 9.8 MB |
| `gene:/home/bo/simulation-gap/venv` | python 3.12 venv for jax and the repo |
| `gene:/home/bo/simulation-gap/install.log` | full pip transcript |
| `gene:/home/bo/simulation-gap/constraints.txt` | pins that force pip cache hits, see below |

## gene, as found

Ubuntu 6.8.0-139, python 3.12.3, 15 GB RAM, 339 GB free on `/`.
GPU is a GTX 1060 6 GB, compute capability 6.1, driver 580.173.02, no CUDA toolkit
installed system wide and no nvcc on PATH. An existing venv at
`~/dream-house/ComfyUI/.venv` runs torch 2.8.0+cu126 on the card, so the driver and
the card are known good for CUDA 12 work.

Network is a USB phone tether on `enx020066306061`, 192.168.42.186. Measured pip
throughput 1.1 MB/s on a 16 MB numpy wheel. Every download is therefore budgeted.

## The pip cache trick

`~/.cache/pip/http-v2` already holds 3.8 GB, mostly the NVIDIA runtime wheels that
torch 2.8+cu126 pulled in. Those same wheels satisfy the jax cuda12 plugin, but only
if pip resolves to the exact versions already cached, which it will not do on its own
because it takes the newest version that satisfies the range. `constraints.txt` pins
them to the installed torch set:

```
nvidia-cublas-cu12==12.6.4.1
nvidia-cuda-cupti-cu12==12.6.80
nvidia-cuda-nvrtc-cu12==12.6.77
nvidia-cuda-runtime-cu12==12.6.77
nvidia-cudnn-cu12==9.10.2.21
nvidia-cufft-cu12==11.3.0.4
nvidia-cusolver-cu12==11.7.1.2
nvidia-cusparse-cu12==12.5.4.2
nvidia-nccl-cu12==2.27.3
nvidia-nvjitlink-cu12==12.6.85
```

All ten satisfy the plugin's floors, so this is a pin and not a downgrade.

## Install commands actually run

```
ssh gene
mkdir -p /home/bo/simulation-gap
rsync -az --exclude .git /home/bolgac/projects/simulation-gap/deeptangle/ gene:/home/bo/simulation-gap/deeptangle/
cd /home/bo/simulation-gap
python3 -m venv venv
./venv/bin/pip install --upgrade pip setuptools wheel
./venv/bin/pip install -c constraints.txt "jax[cuda12]"
./venv/bin/pip install -c constraints.txt absl-py dm-haiku optax chex dm-pix \
    scikit-learn scikit-image scikit-video matplotlib numba trackpy
./venv/bin/pip install --no-deps -e /home/bo/simulation-gap/deeptangle
```

cuda12 and not cuda13: CUDA 13 dropped Pascal, so the cuda13 wheels are useless on
this card.

## Ground truth for real data, resolved

Zenodo record 8093305, CC-BY-4.0, three files. Only the small one is needed:

| File | Size | Needed? |
|---|---|---|
| `labeled_data.zip` | 57.5 MB | yes, this is the evaluation set |
| `syntehthic_dataset.zip` | 643.1 MB | no, we regenerate synthetic data ourselves |
| `videos.zip` | 8.0 GB | no, the labelled clips are already cropped out |

`labeled_data.zip` holds 178 clips of 11 frames at 256 by 256 8-bit grayscale, cut from
9 experimental videos at worm densities 1x, 1.5x, 2x, 3x, 4x, 6x, 8x, 10x and 13x.
`labels.json` gives, for the middle frame `05.png` of each clip, a list of splines with
`x` and `y` lists of 5 to 18 hand-clicked points. Total 1474 labelled centrelines, which
matches the paper's "~200 random regions ... ~1500 labeled worm centerlines".

Frame geometry matches train.py's defaults exactly: 256 by 256, 11 frames, middle frame
labelled, so the labelled clips are a drop-in input.

Real frames have dark worms on a bright background (median 187, min 107 of 255), so they
must be inverted, as `examples/detect.py` does with `255 - clip` followed by CLAHE.

Measured on the labelled set, for the simulator-matching question:

| Quantity | Real data | Simulator default |
|---|---|---|
| Centreline length | median 29.5 px, 5th to 95th pct 21.9 to 34.8 | `L ~ uniform(30, 45)`, mean 37.5 |
| Body width, FWHM of the perpendicular intensity profile | median 2.50 px | `R = 0.8` radius, hardcoded, plus blur sigma 1.5 |
| Raw pixel standard deviation | 3.3 at 1x rising to 13.1 at 10x | background `uniform(0.01, 0.2)`, white noise std 0.01 |

Only 44 percent of real worms fall inside the simulator's length support. The 2022-01-24
videos (1x, 2x, 3x) have shorter worms, median 23.8 px, than the 2022-02-14 videos
(4x through 13x), median about 30 px, so "the real distribution" is really two.

## Published weights

`https://sid.erda.dk/share_redirect/cEjIpG1yQl`, 164 MB, unzips to
`weights/{arrays.npy, tree.pkl, eigenworms_transform.npy, experiment.json}`.
`arrays.npy` is 177 MB, roughly 44 M float32 parameters.

`experiment.json` records the settings that produced the published model, and they are
not the repo defaults:

| Flag | Published run | train.py default |
|---|---|---|
| batch_size | 128 per device, 8 devices | 40 |
| train_steps | 300000, and it was resumed from an earlier checkpoint `3a62da01` | 100000000 |
| wloss_s | 20.0 | 100.0 |
| wloss_p | 1e11 | 1e5 |
| warmup | 1000 | 100 |
| seed | 87 | 42 |

Everything else (nframes 11, size 256, nworms 5 to 250, clip_duration 0.55, kpoints 49,
npca 12, latent_dim 8, n_suggestions 8, cutoff 48, sigma 10) matches the defaults.

## What the repo lets you vary, and what it does not

train.py exposes only six things that touch the simulator: `--nworms` (a list, one
dataset per entry, a step draws one at random), `--clip_duration`, `--nframes`,
`--size`, `--kpoints` and `--sim_dropout`. Everything that decides what a worm looks
like and how it moves is a literal inside `celegans/simulation.py` and
`celegans/clips.py`. A study that sweeps simulator settings therefore cannot be run
with flags alone.

`sweep/` adds that without touching the clone:

| File | What it does |
|---|---|
| `sweep/simconfig.py` | `SimConfig` dataclass holding all 27 hidden settings, defaults copied from commit 7c9775d, JSON in and out |
| `sweep/patch.py` | replaces `celegans.simulation.sampling_params` and `celegans.clips.video_synthesis` with configured versions at runtime |
| `sweep/sweep_run.py` | train.py plus `--simconfig=path`; with no flag it is exactly train.py |
| `sweep/sim_stats.py` | measures a synthetic clip the same way the real clips were measured |
| `sweep/eval_real.py` | scores a checkpoint on the 178 labelled clips using the paper's asymmetric DTW at a 3.0 px cutoff |
| `sweep/configs/` | 16 example one-axis configs: worm length, body radius, sensor noise, drag anisotropy |

`sampling_params` is looked up as a module global by both `simulate` and `sim_pca`, so
replacing the module attribute reaches both. `video_synthesis` is bound by name into
train.py's namespace at import, so `patch.apply` replaces that reference too.

`sweep_run.py` deliberately has no "train" in its path. `deeptangle/logger.py` chooses
which module's flags to record in `experiment.json` by substring-matching "train"
against module paths and taking the first match, so a second matching module would
shadow train.py's flags in the run record.

## Results

### JAX on the Pascal card: it works

```
jax: 0.11.1 jaxlib: 0.11.1
backend: gpu
devices: [CudaDevice(id=0)]
device kind: NVIDIA GeForce GTX 1060 6GB | platform: gpu
2048^3 matmul x20: 0.283s = 1.21 TFLOP/s fp32
conv7x7 on 8x256x256x11 -> 64ch, x20: 0.063s
```

No CPU fallback, no compute-capability complaint. The card's fp32 peak is about
4.4 TFLOP/s, so 1.21 measured on a 2048 matmul is a normal fraction of peak.

The install cost 2.5 GB of tether (pip cache went from 3.8 GB to 6.3 GB) and about
30 minutes. The constraints file did not in fact hit the cache: torch's NVIDIA wheels
came from download.pytorch.org and jax's come from PyPI, so the URLs differ and pip's
http cache missed. The pins are still right to keep, they just did not save anything.
The venv is 4.9 GB on disk.

### Cost of one training run

Measured with `--eval_interval=1`, which forces a device_get every step, because JAX
dispatches asynchronously and a run that never syncs times nothing. Per-step cost is
`(t(40 steps) - t(10 steps)) / 30`, which cancels import, PCA and compile.

Only one JAX process may touch this card at a time. XLA preallocates 75 percent of the
6 GB, and a second process then fails with `INTERNAL: no supported devices found for
platform CUDA`, which reads like a driver or compute-capability problem and is not one.
An early round of my own measurements was ruined by two of my jobs overlapping; every
number below was taken with the card otherwise idle, and the contended runs were thrown
away.

At 256 by 256, 11 frames, kpoints 49, npca 12, all other flags default:

| worms | batch | s per step | clips per second |
|---|---|---|---|
| 50 | 4 | 0.249 | 16 |
| 50 | 8 | 0.377 | 21 |
| 50 | 16 | 0.43 | 37 |
| 50 | 24 | 0.638 | 38 |
| 50 | 32 | out of memory, wanted 4.62 GiB | |
| 250 | 16 | 0.636 | 25 |
| 250 | 24 | 0.843 | 28 |
| 5 to 250 mixed, all seven | 16 | 0.788 | 20 |

The batch-16 figure is the mean of three runs at 0.397, 0.448 and 0.433, so repeat
noise is about 10 percent and the single-run numbers should not be read more finely
than that. Throughput plateaus near 37 clips per second; batch 24 buys nothing over
batch 16 and batch 32 does not fit.

A separate probe at `--train_steps=2` confirms the memory envelope on an idle card:
every combination of nworms in 5, 50, 100, 250 with batch in 4, 8, 16, 24 runs. Only
batch 32 fails, and it fails at every worm count.

Startup is 66 to 78 s for a single worm count: imports, the 100000-worm PCA, and one
XLA compile. With the published run's seven worm counts (`--nworms=5,10,50,100,150,200,250`)
startup is 187 to 193 s, because each worm count is a separate dataset and a separate
compile.

### Sizing the sweep

The published model is 300000 steps at batch 128 on eight A5000s, and it was itself
resumed from an earlier checkpoint, so at least 3.1e8 clip-samples. gene does 37 clips
per second at its best setting, so the published budget is about 96 days on this card.
That run cannot be reproduced here and the sweep must not pretend to.

What fits: at batch 16, nworms 50, one run of N steps costs 0.43 N + 73 seconds.

| steps | clips seen | wall clock per run | 12 configs |
|---|---|---|---|
| 2000 | 3.2e4 | 15 min | 3.0 h |
| 5000 | 8.0e4 | 37 min | 7.4 h |
| 10000 | 1.6e5 | 73 min | 14.6 h |
| 20000 | 3.2e5 | 2.4 h | 29 h |

A 5000-step run sees 0.026 percent of the published sample budget. Whether a model
trained that briefly ranks simulator settings the same way a fully trained one would
is the open question the pilot has to answer, by training one config at 5000 and again
at 20000 and checking whether the real-data score has stopped moving.

Each checkpoint is 177 MB, so 12 configs is 2.1 GB. gene has 332 GB free.

### Synthetic against real, measured the same way

`sweep/sim_stats.py` measures a synthetic clip exactly as the real clips were measured.
Both numbers below are medians after 1st/99th percentile normalisation, with the real
clips inverted first.

| Setting | Synthetic | Real | Verdict |
|---|---|---|---|
| repo defaults | length 37.2 px | 29.5 px | simulator worms are 26 percent too long |
| repo defaults | body FWHM 2.70 px | 2.50 px | close, slightly thick |
| repo defaults | foreground fraction 0.038 | 0.033 to 0.083 by density | in range |
| `L_low=25, L_high=35` | length 29.4 px | 29.5 px | matches |
| `R=0.4` | FWHM 2.50 px | 2.50 px | matches |
| `R=1.6` | FWHM 3.70 px | 2.50 px | too thick |
| `noise_std=0.1` | foreground fraction 0.45 | 0.033 to 0.083 | far too noisy |

So on the two axes that are cheap to measure without labels, matching real statistics
would move the simulator to shorter and thinner worms than the repo ships. That is a
real, testable prediction for the study, and the knobs to make it are the ones the
repo does not expose.

### The real-data score, validated against the published model

`sweep/eval_real.py` scores a checkpoint on all 178 labelled clips with the paper's own
asymmetric DTW at its 3.0 px cutoff. Run against the published weights:

| | Result |
|---|---|
| labels | 1474 |
| found within 3.0 px | 1454 |
| recall | 0.9864 |
| median aDTW | 0.50 px |
| predictions emitted | 6852 |

Recall by density is 1.000 at 1x, 1.5x, 2x and 3x, then 0.968, 0.996, 0.989, 0.978 and
0.987 at 4x, 6x, 8x, 10x and 13x. A median of 0.50 px sits exactly where the paper puts
human labelling accuracy, "the half-pixel level", so the harness agrees with the paper
on the paper's own model. This is the reference any sweep-trained model is measured
against.

Recall is the usable score. Precision is not: the model emits 6852 predictions for 1474
labels, and the humans plainly did not label every worm in every crop, so the ratio
measures the labelling effort rather than the model.

One bug in this harness is worth recording because anyone rebuilding it will hit it.
`asymmetric_dtw` walks the label points monotonically along the predicted centreline,
so it is not invariant to head/tail order, and the model's orientation is arbitrary:
train.py's own loss takes the minimum over the label and its reverse. Scoring without
that flip gave a flat recall of 0.509 across every density, from 1.3 worms per clip to
17.6, which is the tell. A genuine detection limit falls off with density; a coin flip
does not. With the flip, 0.509 becomes 0.986.

### Full pipeline, proven end to end

```
python sweep_run.py --simconfig=configs/L_25_35.json --train_steps=60 \
    --eval_interval=10 --warmup=5 --nworms=50 --batch_size=16 --save \
    --checkpoint_dir=/home/bo/simulation-gap/runs/L_25_35
```

logs `differs from repo defaults in: {"L_low": 25, "L_high": 35}`, trains with the loss
falling from 124 to 57 over 60 steps, and writes
`runs/L_25_35/simconfig.json` plus `runs/L_25_35/<uid>/{arrays.npy, tree.pkl,
eigenworms_transform.npy, experiment.json}`, which is the layout `eval_real.py` and
`dt.load_model` expect.

`sweep_run.py` chdirs into the clone before calling `train.main`, after resolving
`--simconfig` and `--checkpoint_dir` to absolute paths. Without that, `logger.py`'s
`git rev-parse HEAD` runs in whatever directory you launched from and the run dies at
startup with `CalledProcessError 128`. For the same reason the clone on gene needs its
`.git` directory; an rsync that excludes it breaks training.

### Loose end

gene went unreachable over Tailscale at about 22:45 on 14 Sep, right after an
`eval_real.py` run on a 60-step checkpoint. The laptop's own internet was fine at the
time (pypi answered 200), and twenty reconnection attempts over nine minutes all timed
out. An undertrained model puts thousands of low-quality predictions through
`non_max_suppression`, which is an O(n^2) numba loop with array copies on each pass, so
that run was almost certainly thrashing the box. Two consequences for the sweep: raise
`--score_threshold` when scoring early checkpoints, and expect the tether to drop.

Not affected: every measurement above was taken and recorded before the outage. Not
done: scoring a freshly trained checkpoint end to end, which is the one step still
unverified, though the scoring path itself is validated on the published weights.
