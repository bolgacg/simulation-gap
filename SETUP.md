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

Five of those six, not six. `--sim_dropout` is a dead flag. train.py defines it and
records it in `experiment.json`, but the call is

```python
sim_fn = lambda key: simulate(
    key, nworms, FLAGS.clip_duration, FLAGS.nframes, FLAGS.size, FLAGS.kpoints
)
```

with no eighth argument, so `simulate`'s `dropout: float = 0` is always 0 and
`drop_param` never runs. Setting `--sim_dropout` in a sweep changes nothing and the
run record will say it did. It would not work even if wired up: `drop_param` decides
with Python's `random.random()` inside a function traced under `vmap`/`pmap`, so the
choice would be frozen into the compiled function rather than redrawn per batch.

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

### Act three: the unlabelled statistics, complete for all 16 configurations

`sweep/unlabelled_stats.py` and `sweep/run_stats_sweep.py`, output in
`data/stats_sweep.json`, rolled into `data/results.json`.

The first version of this used `sim_stats.py`, and that was wrong for the purpose.
On the real side it measures worm length and body width using the hand labels to know
where the worms are. Fine for describing the gap, fatal for the thesis test, which
asks whether statistics available without labels pick good settings. Statistics that
need labels answer the question by assumption.

Everything in `unlabelled_stats.py` is computed from raw pixels: intensity quantiles,
gradient magnitude, a granulometry curve from morphological openings at radii 1, 2, 3,
4 and 6 as the unlabelled stand-in for body width, and three frame-to-frame motion
statistics. Real and synthetic go through identical code; real frames are inverted
first. Density is matched by construction rather than controlled for: labels sit in a
disc covering a quarter of the frame, so the real full-frame worm count runs from
about 5 to about 71, and synthetic clips are generated across that same ladder and
pooled. Distance is the mean absolute z-score against the spread across the 178 real
clips. The whole sweep takes under three minutes on the laptop CPU.

| Config | Axis | Distance to real |
|---|---|---|
| R_120 | body radius | 0.540 |
| R_160 | body radius | 0.566 |
| L_20_30 | worm length | 0.751 |
| L_25_35 | worm length | 0.758 |
| alpha_wide | drag | 0.787 |
| alpha_tight | drag | 0.799 |
| defaults | none | 0.802 |
| L_35_55 | worm length | 0.817 |
| R_040, R_060 | body radius | 1.015 |
| noise_000 | noise | 1.544 |
| noise_005 | noise | 2.782 |
| noise_010 | noise | 3.390 |

#### First, the noise floor, because two of these numbers do not clear it

The whole sweep was re-run with three simulator seeds, nothing else changed. The median
seed-to-seed spread in the distance is 0.231 and the largest is 0.276, so a gap below
about 0.23 is the luck of which ten clips were drawn. Seed-averaged distances:

| Config | Mean over 3 seeds | Config | Mean over 3 seeds |
|---|---|---|---|
| R_120 | 0.386 | L_20_30 | 0.667 |
| R_160 | 0.485 | L_35_55 | 0.687 |
| L_25_35 | 0.645 | R_040, R_060 | 0.847 |
| alpha_wide | 0.647 | noise_000 | 1.689 |
| defaults | 0.659 | noise_005 | 2.889 |
| alpha_tight | 0.662 | noise_010 | 3.437 |

Rank correlation between seeds is 0.82, 0.81 and 0.95: the broad ordering is stable,
the fine ordering is not. The floor is this large because each configuration is measured
from only ten synthetic clips; more clips would shrink it, and that is the fix rather
than a tighter claim.

#### Noise, which clears the floor easily

The authors' own setting is a minimum: 0.66 at std 0.01 against 1.69 with noise off,
2.89 at 0.05 and 3.44 at 0.10. The nearest gap is 1.03, over four times the floor, and
the ordering holds under all three seeds. That number was not picked arbitrarily.

#### Body radius, which clears the floor but only just

R_120 at 0.39 against the repo's 0.66 is a gap of 0.27, 1.2 times the floor, so the
direction is real but weak. It says thicker, which contradicts the labelled measurement
that real bodies are 2.50 px wide against 2.70 px already simulated at R=0.8. Every
subset of the statistics agrees on thicker, granulometry included, so this is not one
axis compensating for another. The granulometry curves show what is going on, and they
are about the shape of a curve rather than the scalar, so they stand clear of the floor:

| Opening radius | r=1 | r=2 | r=3 | r=4 | r=6 |
|---|---|---|---|---|---|
| Real | 0.851 | 0.678 | 0.556 | 0.488 | 0.393 |
| R=0.8 | 0.815 | 0.608 | 0.461 | 0.382 | 0.281 |
| R=1.6 | 0.849 | 0.673 | 0.450 | 0.341 | 0.235 |

Real frames hold more bright signal than synthetic at every scale. Thickening closes
the small-scale gap almost exactly and widens the large-scale one. No body radius
reproduces the shape of the real curve, because real frames carry bright structure at
scales larger than a worm that the simulator does not produce at any radius: plate
debris and out-of-focus material are the obvious candidates. A scalar distance has one
lever on that error, so it turns "this simulator cannot make images like these" into
"make the worms thicker". A laboratory tuning on it would thicken its worms and never
find what is actually missing.

#### Worm length, withdrawn

An earlier version of this file claimed the statistics prefer shorter worms and so
agree with the direct measurement. Seed-averaged, the four settings span 0.645 to 0.687,
a range of 0.042, under a fifth of the floor. The claim does not survive and is
withdrawn. The labelled measurement of 29.5 px real against 37.5 px simulated still
stands on its own; what is gone is the idea that the unlabelled statistics corroborate
it. The ordering also moves with the statistic set: spatial statistics alone prefer the
longest setting, granulometry and motion alone prefer the shortest.

#### Drag anisotropy, the useful negative

The axis spans 0.647 to 0.662, a range of 0.016, which is 0.07 of the floor. Put beside
the physics this is the strongest thing here. Alpha is the one simulator parameter that
can be shown wrong from first principles: the code draws `abs(normal(4, 4) + 1.0)`,
median 5.06, where slender-body theory puts the normal-to-tangential drag ratio at 1.5
to 2, and only 4.8 percent of draws land in that range while 71.5 percent exceed 3.
Moving it from the unphysical default to the physical value changes the unlabelled
statistics by nothing measurable. A method that chooses simulator settings by matching
unlabelled image statistics would not find this simulator's most clearly mis-set
parameter.

#### One caution about the sweep's shape

Four of the sixteen configs (`L_30_45`, `R_080`, `alpha_repo`, `noise_001`) hold the
repo's own values on their axis, so they are the defaults under another name and score
identically; they are kept as on-axis reference points and flagged
`is_repo_default_on_its_axis`, but the sweep moves four axes across thirteen distinct
settings, not sixteen.

### The real-data score, validated against the published model

`sweep/eval_real.py` scores a checkpoint on all 178 labelled clips with the paper's own
asymmetric DTW at its 3.0 px cutoff. Run against the published weights:

| | Result |
|---|---|
| labels | 1474 |
| found within 3.0 px | 1454 |
| recall | 0.9864 |
| median aDTW | 0.50 px |
| predictions emitted | 6854 |
| precision, whole frame | 0.2110 |
| labels inside the labelled disc | 1416 |
| found inside the disc | 1402 |
| recall inside the disc | 0.9901 |
| precision inside the disc | 0.7762 |

Recall by density is 1.000 at 1x, 1.5x, 2x and 3x, then 0.968, 0.996, 0.989, 0.978 and
0.987 at 4x, 6x, 8x, 10x and 13x. A median of 0.50 px sits exactly where the paper puts
human labelling accuracy, "the half-pixel level", so the harness agrees with the paper
on the paper's own model. This is the reference any sweep-trained model is measured
against.

Precision has to be scored inside the region the annotators worked in or it is
meaningless. 97 percent of the 13,232 clicked points fall in a disc of radius 72 px
centred at (113, 116), which is a quarter of the 256 px frame, while detections are
made over the whole of it. A correct detection outside that disc has no label it could
ever match and is counted as a false positive. Restricting both sides to the disc takes
precision from 0.211 to 0.776. It is still a lower bound, because an annotator marking a
constant fraction of the worms inside the disc cannot be ruled out from these files.
Recall is unaffected by the restriction, 0.9864 against 0.9901.

The same script gives the same numbers on gene's GPU and on the laptop CPU, to every
digit printed, so a score taken on one is comparable to a score taken on the other.

An optional cap on how many candidates reach non-maximum suppression exists for
scoring undertrained checkpoints, and it is off by default because it is not free. On
the published weights a cap of 600 drops recall from 0.984 to 0.809 and 1200 to 0.977.
Any run where it binds reports `cap_bound_on_clips`.

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

### The gate: can anything trainable here detect a real worm?

With gene gone, the defaults configuration was trained on the laptop CPU at a reduced
size: 128 px frames, 30 worms, batch 4, 3.7 s per step, 800 steps in four resumed
segments of 200, so each curve point cost one evaluation instead of a retrain.
`kpoints`, `npca`, `latent_dim` and `n_suggestions` were kept at the published values
so the model has the same shape as the released one, and it is scored at the full
256 px, which a fully convolutional detector allows.

| Steps | Recall on 40 real clips | Predictions | Median aDTW |
|---|---|---|---|
| 200 | 0.0000 | 40 | none within cutoff |
| 400 | 0.0000 | 0 | none |
| 600 | 0.0000 | 0 | none |
| 800 | 0.0000 | 1101 | 23.01 px |

Flat zero. The model is training, the loss falls from 114 at step 50 to 67 at step 100
with the confidence term dropping from 12.1 to 1.30, but 800 steps at batch 4 is 3200
clips against the published model's 3.1e8, five orders of magnitude short.

The zero deserves one more check, because "scores zero at threshold 0.5" could hide a
model that localises worms but is not confident about them. It does not. Sweeping the
confidence threshold on the 800-step checkpoint:

| Threshold | Recall | Precision | Predictions per label | Median aDTW |
|---|---|---|---|---|
| 0.5 | 0.0000 | 0.0000 | 1.7 | 21.49 px |
| 0.2 | 0.0000 | 0.0000 | 1.9 | 25.76 px |
| 0.1 | 0.0015 | 0.0008 | 1.9 | 24.74 px |
| 0.05 | 0.0106 | 0.0041 | 2.6 | 24.15 px |
| 0.02 | 0.1377 | 0.0138 | 9.8 | 6.13 px |
| 0.01 | 0.2179 | 0.0106 | 20.0 | 4.29 px |

Recall only rises by flooding the frame: at threshold 0.01 the model emits twenty
predictions per label for a precision of 0.011, and the cap bound on all 40 clips so
the real prediction count is higher still. The median distance never falls below
4.29 px, against 0.50 px for the published weights. There is no operating point at
which this model is doing the task.

So the answer to the gate is that no training budget reachable in this session
produces a model that detects a real worm, and the sweep's training half was therefore
not run at all rather than run badly. The statistics half above stands on its own.

### Loose end

gene went unreachable over Tailscale at about 22:45 on 14 Sep, right after an
`eval_real.py` run on a 60-step checkpoint, and did not come back for the rest of the
session despite retries across four hours. The laptop's own internet was fine
throughout (pypi answered 200). An undertrained model puts thousands of low-quality
predictions through `non_max_suppression`, an O(n^2) numba loop with array copies on
each pass, so that run was almost certainly thrashing the box. `eval_real.py` now has
a `--max_predictions` valve for exactly that case, off by default because it is not
free: on the published weights a cap of 600 drops recall from 0.984 to 0.809.

What that cost: the sweep on real data. Everything that does not need a GPU was done
instead, on this laptop, and nothing above is waiting on gene to be believed.
