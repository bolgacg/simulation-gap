# Which simulator setting decides the science?

A detector trained entirely on simulated worms is scored on real microscopy, once per
simulator setting, to find out which of those settings the result actually depends on.
Then the question the fellowship is built on: whether the right settings can be picked
with no labelled real data at all.

Live page: https://bolgacg.github.io/simulation-gap/

Built for the postdoctoral fellowship 165870 at the Niels Bohr Institute, which asks for
work on training with synthetic data and tuning simulations until the trained model
transfers to real experiments. The system taken apart here is
[deeptangle](https://github.com/kirkegaardlab/deeptangle) at commit 7c9775d, MIT licensed,
from the group that advertised the position. Their detector, their simulator, their
published weights, and a question that is open inside all three.

## Why this system

deeptangle finds overlapping *C. elegans* in dense microscopy. It never sees a real worm
in training. Every frame it learns from comes out of `celegans/simulation.py`, so the
distance between that simulator and a real dish is the whole of its accuracy, and nobody
has published what that distance is made of.

## What is measured

One number per training run: the share of hand-marked worms the model finds within three
pixels, using the paper's own asymmetric dynamic time warping distance between a predicted
centreline and a labelled one. The evaluation set is
[Zenodo 8093305](https://zenodo.org/records/8093305), CC BY 4.0, from the same group: 178
clips of real footage at worm densities from one to thirteen times, carrying 1,474
hand-clicked centrelines.

The published weights score 0.509 on that set. The paper reports no directly comparable
figure, so this is an internal reference point rather than a reproduction, and the page
says so where it uses it.

## The three acts

1. **The baseline.** What the published model does on real footage, and what the same
   architecture does when retrained here at a shorter schedule. Every swept number is
   compared against the retrained figure, because comparing against weights trained three
   hundred thousand steps on eight devices would measure the schedule rather than the
   simulator.
2. **One setting at a time.** Sixteen configurations across four axes: worm length, body
   radius, drag anisotropy and sensor noise. Each is a full retrain and a full scoring
   run, changing one thing.
3. **Can you choose without labels?** Rank the configurations by how closely their
   synthetic frames match real frames on image statistics alone, using no labels, and
   check whether that ranking picks the configurations that actually score best. The
   correlation is reported whichever way it comes out.

A null in act three is the more useful result for this reader. If cheap unlabelled
statistics did pick the right simulator, everyone would already be doing it.

## Two things settled by measurement rather than assumption

**How far the evaluation set can be trusted, and where the argument stops.** The dataset
ships no statement about whether every worm is labelled, and it matters: an unlabelled worm
counts against precision unfairly. Two tests, and the second exists because the first does
not finish the job.

Labels per clip rise in proportion to the stated worm density on a line through the origin,
1.33 a clip at the lowest density rising to 17.62 at the highest, fitted at 1.39 per unit
density with an R squared of 0.974. **That rules out a fixed quota per clip and nothing
more.** Someone marking half the worms in every clip produces a line through the origin too,
with half the slope and a fit just as good, and no geometry in these files separates them.

So a second test, for the way a human actually labels partially, which is to skip the hard
ones. The hard case here is a worm crossing another worm, and in a field of n labelled worms
there are n(n-1)/2 pairs that could cross, so marking every worm regardless of difficulty
makes crossings grow as roughly the square of the count. Measured exponent 2.31 against 2.0.
The tangled worms are in the labels.

A constant fraction still cannot be excluded, so **precision is reported as a lower bound**
rather than as a false-alarm rate, and always with the confidence threshold it depends on.

A third attempt was thrown out. It tried to find unlabelled worms directly by thresholding
each frame at the intensity of its own labelled centrelines, and said only 23 percent of
worm-shaped objects carried a label. At these densities touching worms merge into one object
and a faint mid-body breaks into several, so it measured the threshold rather than the
labelling. The docstring says so.

**How much training the comparison needs.** Every model here is trained far below the
published schedule, so the defaults configuration is scored at several points along its
training rather than only at the end. If that curve is flat the sweep is comparing noise
against noise and the page says the result is inconclusive. If it is still climbing, the
models are cut off early but the comparison between them is fair, because every
configuration gets the identical schedule.

## What the simulator does not cover

Measured before any model was trained, on the labelled clips against the simulator's own
defaults:

| Quantity | Real footage | Simulator default |
|---|---|---|
| Centreline length | median 29.5 px, 5th to 95th percentile 21.9 to 34.8 | drawn uniform on 30 to 45, mean 37.5 |
| Body width | median 2.50 px | radius 0.8 with blur sigma 1.5 |
| Pixel standard deviation | 3.3 at the lowest density, 13.1 at ten times | background uniform on 0.01 to 0.2, noise 0.01 |

Only 44 percent of real worms fall inside the length range the simulator can produce. And
"the real distribution" is two distributions: worms recorded on 24 January 2022 have a
median length of 23.8 px against about 30 px for those recorded on 14 February. A single
setting cannot match both, which is a limit on the whole approach rather than on this
sweep.

## The part that took the work

`train.py` exposes six flags that reach the simulator. Everything deciding what a worm
looks like and how it moves is a literal inside `celegans/simulation.py` and
`celegans/clips.py`, so a sweep cannot be run with flags. `sweep/` lifts 27 of those
settings into a configuration object and patches them in at run time, without editing the
clone. `SETUP.md` records how, including the two traps: `sampling_params` is read as a
module global by two different functions, and `deeptangle/logger.py` picks which module's
flags to record by substring-matching the word "train" against module paths, so a second
module with "train" in its path silently shadows the real one in the run record.

## Layout

| Path | What it does |
|---|---|
| `sweep/simconfig.py` | the 27 settings as one object, defaults copied from commit 7c9775d |
| `sweep/patch.py` | installs a configuration into the simulator at run time |
| `sweep/sweep_run.py` | `train.py` plus a configuration file; with no flag it is `train.py` |
| `sweep/sim_stats.py` | measures a synthetic clip exactly as the real clips were measured |
| `sweep/eval_real.py` | scores a checkpoint on the 178 labelled clips |
| `sweep/configs/` | the sixteen one-axis configurations |
| `study/labelling_exhaustive.py` | whether the evaluation set is labelled exhaustively, which decides if precision means anything |
| `study/check_contract.py` | checks the results file against the fields the page reads, before the page is built |
| `study/build_page_data.py` | writes `docs/data.js` |
| `study/verify_page.js` | headless checks: overflow, script errors, the walkthrough at both widths |
| `SETUP.md` | what was installed, what was measured, and what broke |

`deeptangle` itself is not vendored here. It is cloned per `SETUP.md` and left untouched.

## What it cannot tell you

- Four of the simulator's settings are swept, not all of them. This is a sample of the
  simulator rather than a survey, and nothing here speaks for the settings left alone.
- No interactions between settings are measured. Each configuration moves one thing.
- A difference between two configurations means nothing until you know how far the same
  configuration moves when only the random seed changes, so the default settings are
  trained more than once and the spread between those runs is the floor. The page refuses
  to say which setting is worth tuning unless the largest effect clears that floor, and if
  nothing clears it the page says so instead of ranking noise.
- The schedule here is far shorter than the published one. It is held identical across
  every configuration, so the comparison between them is fair, but none of these models is
  as good as the published one.
- Labelled real data is a fixed set of 178 clips from nine videos on two days. A setting
  that suits those clips is not thereby a setting that suits a different laboratory.

## Sources

kirkegaardlab/deeptangle, MIT, commit 7c9775d. Labelled clips from Zenodo record 8093305,
CC BY 4.0. Both from Kirkegaard's group. Advertisement for fellowship 165870.

Bolgaç Gülen, September 2026.
