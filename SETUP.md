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

Filled in below as each step finishes.
