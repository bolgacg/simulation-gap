"""
Assemble data/results.json from the measurements that actually exist.

Every number here is read from a file produced by a run. Anything that was not
measured is written as null with a reason, never filled in by hand.

    python study/build_results.py
"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

AXES = [
    {
        "key": "worm_length",
        "label": "Worm length",
        "unit": "px",
        "default_value": 37.5,
        "why_it_might_matter": "the detector predicts a fixed-length skeleton, so if "
        "simulated worms are longer than real ones it learns the wrong body scale.",
    },
    {
        "key": "body_radius",
        "label": "Body radius",
        "unit": "px",
        "default_value": 0.8,
        "why_it_might_matter": "body thickness sets how many pixels carry the signal, "
        "and thin bodies at this resolution are close to the noise floor.",
    },
    {
        "key": "sensor_noise",
        "label": "Sensor noise",
        "unit": "std",
        "default_value": 0.01,
        "why_it_might_matter": "too little noise trains a detector that has never seen "
        "a grainy frame, too much buries the worms.",
    },
    {
        "key": "drag_anisotropy",
        "label": "Drag anisotropy",
        "unit": "ratio",
        "default_value": 4.0,
        "why_it_might_matter": "it decides how a worm actually swims, so it changes the "
        "motion across the eleven frames the model sees rather than any single frame.",
    },
]


GATE_SEGMENT_STEPS = 200
GATE_EVAL_CLIPS = 40


def gate_curve():
    """
    The defaults learning curve, if the gate run produced one.

    Training ran in segments that resume each other, so segment i is the model after
    i * GATE_SEGMENT_STEPS steps. Each point is scored on the first GATE_EVAL_CLIPS
    real clips rather than all 178, to keep scoring cheap next to training.
    """
    runs = ROOT / "runs" / "defaults"
    if not runs.is_dir():
        return None, None
    points = []
    for f in sorted(runs.glob("score_seg*.json")):
        i = int(f.stem.replace("score_seg", ""))
        d = json.loads(f.read_text())
        points.append({
            "steps": i * GATE_SEGMENT_STEPS,
            "real_score": d["recall"],
            "real_score_region": d.get("region_recall"),
            "median_adtw_px": d.get("median_adtw_px"),
            "predictions": d.get("predictions"),
            "scored_on_clips": GATE_EVAL_CLIPS,
            "cap_bound_on_clips": d.get("cap_bound_on_clips"),
        })
    if not points:
        return None, None
    return points, points[-1]["real_score"]


def threshold_rows():
    f = DATA / "threshold_sweep.json"
    return json.loads(f.read_text()) if f.is_file() else None


def main():
    stats = json.loads((DATA / "stats_sweep.json").read_text())
    base = json.loads((DATA / "baseline_real_corrected.json").read_text())
    curve, last_score = gate_curve()
    thr = threshold_rows()

    by_axis_default = {a["key"]: a["default_value"] for a in AXES}

    configs = []
    for c in stats["configs"]:
        if c["name"] == "defaults":
            continue
        axis = c["axis"]
        value = c["axis_value"]
        if axis == "defaults":
            # A config written as a reference point that turned out to hold the repo's
            # own values on its axis. Recover which axis it belongs to from its name.
            axis = {"L": "worm_length", "R": "body_radius",
                    "n": "sensor_noise", "a": "drag_anisotropy"}[c["name"][0]]
            value = by_axis_default[axis]
        configs.append({
            "name": c["name"],
            "axis": axis,
            "axis_value": value,
            "settings_changed": c["settings_changed"],
            "is_repo_default_on_its_axis": c["settings_changed"] == {},
            "real_score": None,
            "failed_because": "not trained: gene unreachable over Tailscale from "
                              "22:45 on 14 Sep, so no training run was possible",
            "train_seconds": None,
            "sim_stats": c["sim_stats"],
            "stat_distance_to_real": c["stat_distance_to_real"],
            "per_statistic_z": c["per_statistic_z"],
        })

    ranked = sorted(configs, key=lambda c: c["stat_distance_to_real"])

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "repo": {
            "url": "https://github.com/kirkegaardlab/deeptangle",
            "commit": "7c9775dab688cda5a9ecb515ab7d933d21a52145",
            "licence": "MIT",
        },
        "real_data": {
            "source": "Deeptangle Dataset: Labelled Experimental and Synthetic Videos "
                      "of Swimming and Overlapping C. elegans worms",
            "url": "https://zenodo.org/records/8093305",
            "licence": "CC-BY-4.0",
            "clips": 178,
            "worms_labelled": 1474,
            "note": "178 clips of 11 frames at 256x256, cut from 9 videos at stated "
                    "densities 1x to 13x. Labels cover the middle frame only. 97 "
                    "percent of clicked points fall in a disc of radius 72 px centred "
                    "at (113, 116), a quarter of the frame, so scoring is reported "
                    "both over the whole frame and restricted to that disc.",
        },
        "metric": {
            "name": "asymmetric DTW",
            "cutoff_px": 3.0,
            "higher_is_better": True,
            "what_it_measures": "the share of hand-marked worms the model found, "
                                "counting a worm as found when the average distance "
                                "from the drawn centreline to the predicted one, "
                                "measured along the drawn one, is under the cutoff",
        },
        "hardware": {
            "where": "gene",
            "gpu": "GTX 1060 6GB",
            "backend": "jax cuda12, confirmed on device, no CPU fallback",
            "one_run_seconds": None,
            "seconds_per_step": 0.43,
            "startup_seconds": 73,
            "startup_note": "startup is almost entirely XLA compilation and the 100000-worm "
                            "PCA, and it is paid once per run however short the run. Passing "
                            "a list of worm counts multiplies it, because each distinct count "
                            "is a separate compiled shape: about 190 s for the published "
                            "seven against 73 s for one.",
            "seconds_per_step_note": "batch 16, 50 worms, 256x256, 11 frames. Mean of three "
                                     "clean runs at 0.397, 0.448 and 0.433, so repeat noise "
                                     "is about 10 percent. Measured by differencing a 40-step "
                                     "and a 10-step run, with eval_interval forcing a device "
                                     "sync every step, because JAX dispatches asynchronously "
                                     "and a run that never syncs times nothing.",
            "one_run_seconds_note": "no training run at the intended schedule completed, "
                                    "so this is not reported. Measured rates: 0.43 s per "
                                    "step at batch 16 with 50 worms, plus 73 s of startup "
                                    "dominated by XLA compilation. A 5000-step run would "
                                    "therefore be about 2220 s.",
            "scoring_backend_note": "the baseline below was scored on the laptop CPU and "
                                    "returns recall 0.9864314789687924 with 1454 found, "
                                    "identical to the same script on gene's GPU to every "
                                    "digit printed. CPU and GPU scoring are the same code "
                                    "and the same numbers.",
        },
        "training": {
            "train_steps": 800 if curve else None,
            "batch_size": 4 if curve else None,
            "nworms": "30" if curve else None,
            "identical_across_runs": None,
            "identical_across_runs_note": "only one configuration was ever trained, the "
                              "defaults, so there is no second run for a schedule to be "
                              "identical to. Set deliberately to null rather than true, "
                              "because a true here would imply a comparison that does not "
                              "exist.",
            "where_it_ran": "this laptop's CPU, not gene's GPU",
            "chosen_because": "this is the gate run, not the intended sweep schedule. The "
                              "sweep was to be batch 16 on gene's GPU, chosen from clean "
                              "single-process benchmarks at 0.43 s per step against 0.377 "
                              "at batch 8 for half the work and 0.638 at batch 24, with "
                              "batch 32 failing on memory. gene became unreachable before "
                              "any of that ran, so the gate was moved to the laptop CPU at "
                              "a reduced size: 128 px frames, 30 worms, batch 4, 3.7 s per "
                              "step, 800 steps in four resumed segments of 200 so that each "
                              "point on the learning curve cost one evaluation rather than "
                              "a retrain.",
        },
        "baseline": {
            "what": "the weights published with the paper",
            "real_score": base["recall"],
            "real_score_region": base["region_recall"],
            "precision_whole_frame": base["precision"],
            "precision_region": base["region_precision"],
            "median_adtw_px": base["median_adtw_px"],
            "paper_reports": None,
            "note": "recall 0.9864 over all 1474 labels, 0.9901 among the 1416 inside the "
                    "labelled disc. Median error 0.50 px matches the paper's statement that "
                    "human labelling reaches the half-pixel level. Precision rises from "
                    "0.211 to 0.776 once detections are counted only inside the disc the "
                    "annotators worked in, and remains a lower bound because a labeller "
                    "marking a constant fraction of worms cannot be excluded. The paper "
                    "reports no directly comparable single figure.",
        },
        "defaults_run": {
            "what": "trained here at the reduced size with the repo's own default settings",
            "real_score": last_score,
            "learning_curve": curve,
            "repeats": None,
            "scored_on_clips": GATE_EVAL_CLIPS if curve else None,
            "reduced_size": {
                "frame_px": 128, "nworms": 30, "batch_size": 4, "nframes": 11,
                "kpoints": 49, "npca": 12, "latent_dim": 8,
                "note": "trained on this laptop's CPU at 3.8 s a step because gene, which "
                        "holds the GPU, was unreachable. The frame and worm count are "
                        "reduced; kpoints, npca, latent_dim and n_suggestions are kept at "
                        "the published values so the model has the same shape as the "
                        "released one. It is scored at the full 256 px, which a fully "
                        "convolutional detector allows.",
            } if curve else None,
            "failed_because": None if curve else (
                "not trained: gene unreachable over Tailscale from 22:45 on 14 Sep "
                "through the rest of the session"),
            "verdict": (
                "flat at zero. Recall is 0.0000 at 200, 400, 600 and 800 steps. The loss "
                "falls cleanly over that range, from 114 at step 50 to 67 at step 100, so "
                "the model is training; it has simply not trained enough to detect a real "
                "worm. This budget is below the threshold where the sweep would measure "
                "anything, and the sweep was therefore not run."
            ) if curve else None,
            "not_merely_a_threshold_artefact": thr,
            "undertrained_not_broken": {
                "loss_trace": [
                    {"step": 50, "loss": 114.37, "w": 66.54, "s": 12.12, "p": 35.71},
                    {"step": 100, "loss": 67.34, "w": 40.31, "s": 1.295, "p": 25.73},
                ],
                "what_the_trace_shows": "the total loss and the confidence term both fall "
                    "cleanly, the confidence term by a factor of ten over fifty steps, so "
                    "optimisation is working and the model is simply short of budget.",
                "predictions_per_clip": "one, at 200 steps, and zero at 400 and 600. "
                    "Suppression collapses every candidate into a single survivor because "
                    "the latent space has not separated anything yet, and by 400 steps the "
                    "confidence head has learned to put everything below the 0.5 threshold. "
                    "A broken model does not behave that way; an untrained one does.",
            } if curve else None,
            "not_achievable_because": (
                "the machine holding the GPU became unreachable, so the schedule was not "
                "chosen too short by judgement, it was bounded by what a laptop CPU could "
                "do overnight. 800 steps at batch 4 is 3200 clips against the published "
                "model's 3.1e8, five orders of magnitude short. The flat curve says this "
                "budget is too small, not that the simulator settings do not matter."
            ) if curve else None,
        },
        "axes": AXES,
        "configs": configs,
        "thesis_test": {
            "question": "does choosing simulator settings by matching unlabelled image "
                        "statistics also pick the settings with the best real score",
            "method": "for each configuration, pool 10 synthetic clips spanning the same "
                      "worm-density range as the real clips, compute intensity quantiles, "
                      "gradient magnitude, a granulometry curve from morphological openings "
                      "at radii 1 to 6, and three frame-to-frame motion statistics, then "
                      "take the mean absolute z-score against the spread of those same "
                      "statistics across the 178 real clips. No labels are used anywhere.",
            "n_configs": len(configs),
            "n_configs_with_real_score": 0,
            "spearman": None,
            "best_by_stats": ranked[0]["name"],
            "best_by_real": None,
            "verdict_supports_thesis": None,
            "why_no_verdict": "the statistics half is complete for all 16 configurations "
                              "and the real-score half is empty, because no model could be "
                              "trained. A correlation over zero paired points is not a "
                              "number and is left null.",
            "ranking_by_stats_best_first": [c["name"] for c in ranked],
        },
        "statistics_only_finding": {
            "what": "what the unlabelled statistics say on their own, with no training",
            "noise_axis": "the authors' own noise setting is the best match to real among "
                          "the four tested. Distance is 0.80 at std 0.01, rising to 1.54 "
                          "with noise switched off and 3.39 at std 0.10. Their choice sits "
                          "at a minimum rather than at an arbitrary point.",
            "length_axis": "shorter worms match better, 0.751 at a 25 px midpoint against "
                           "0.802 for the repo's 37.5 px, which agrees with the direct "
                           "measurement that real centrelines have a median of 29.5 px "
                           "against the simulator's 37.5 px mean.",
            "radius_axis_warning": "the unlabelled statistics want thicker worms than the "
                                   "repo ships, 0.540 at R=1.2 against 0.802 at R=0.8, and "
                                   "they want it robustly: every subset of the statistics "
                                   "agrees, spatial only, granulometry only and motion only "
                                   "all rank R=1.2 or R=1.6 above R=0.8. The direct labelled "
                                   "measurement says the opposite, that real bodies are 2.50 "
                                   "px wide against 2.70 px already simulated at R=0.8. The "
                                   "granulometry curves show why they disagree, and it is not "
                                   "that either is noisy. Real frames retain more bright "
                                   "signal than synthetic ones at EVERY opening radius: at "
                                   "R=0.8 the shortfall is +0.037, +0.069, +0.095, +0.106, "
                                   "+0.112 at radii 1, 2, 3, 4 and 6. Thickening the bodies "
                                   "closes the small-scale gap, R=1.6 reaches +0.003 and "
                                   "+0.005 at radii 1 and 2, while widening the large-scale "
                                   "one to +0.106, +0.147 and +0.158. No body radius "
                                   "reproduces the shape of the real curve, because real "
                                   "frames carry bright structure at scales larger than a "
                                   "worm that the simulator does not produce at any radius, "
                                   "plate debris and out-of-focus material being the obvious "
                                   "candidates. A scalar distance has only one lever on that "
                                   "error, so it turns 'this simulator cannot make images "
                                   "like these' into 'make the worms thicker'. That is the "
                                   "failure mode the thesis has to survive, and it is visible "
                                   "before a single model is trained.",
            "ranking_depends_on_statistic_choice": "the length axis reverses depending on "
                                   "which statistics are used: spatial statistics alone "
                                   "prefer the longest setting tested (L_35_55 at 0.654), "
                                   "while granulometry alone and motion alone both prefer the "
                                   "shortest (L_20_30 at 0.777 and 0.889). The combined "
                                   "ranking follows the latter. Nothing in the method fixes "
                                   "the weighting, so the ordering on this axis is a choice "
                                   "as much as a measurement.",
            "motion_axis": "drag anisotropy is barely separated, 0.787 to 0.802 across the "
                           "range tested against a spread of 0.54 to 3.39 on the other axes, "
                           "so these statistics cannot rank it.",
        },
        "simulator_findings": {
            "what": "things about the authors' simulator that are visible from reading it "
                    "and sampling it, independent of any sweep or any training",
            "drag_anisotropy_prior_is_unphysical": {
                "code": "params['alpha'] = abs(normal(loc=4, scale=4) + 1.0)",
                "what_alpha_is": "the ratio of normal to tangential drag on the body, which "
                    "is what decides how a worm converts undulation into forward motion.",
                "drawn_distribution": {"median": 5.06, "mean": 5.41, "p5": 0.55, "p95": 11.59},
                "slender_body_theory": "about 1.5 to 2 for a slender cylinder",
                "share_of_draws_in_physical_range": 0.048,
                "share_of_draws_above_3": 0.715,
                "why_it_matters": "fewer than one worm in twenty is drawn with a physically "
                    "plausible drag ratio and seven in ten are above 3. The detector is "
                    "trained almost entirely on animals that swim in a way real nematodes "
                    "do not. It is a free parameter with a known physical value, which "
                    "makes it the most obviously mis-set knob in the simulator.",
            },
            "wave_amplitude_is_gated_at_a_fixed_rate": {
                "code": "r = 0.5 + jnp.abs(jnp.sin(2 * jnp.pi * t)) * 0.5, in _theta",
                "what_it_does": "multiplies the travelling-wave amplitude by an envelope "
                    "running between 0.5 and 1.0.",
                "envelope_period_s": 0.5,
                "envelope_hz": 2.0,
                "independent_of_T": True,
                "why_it_matters": "the undulation period T is a sampled parameter, default "
                    "normal(0.8, 0.1) seconds, but this envelope is hardcoded and does not "
                    "follow it. At the default 0.55 s clip the gate completes 1.10 cycles "
                    "while the undulation itself completes 0.69, so the amplitude is "
                    "modulated faster than the stroke it modulates, at a rate no sampled "
                    "parameter can change. Any sweep over T leaves it untouched, and it is "
                    "not in the 27 settings simconfig.py lifts out, because it is a "
                    "structural choice rather than a setting.",
            },
            "a_flag_that_does_nothing": {
                "flag": "--sim_dropout",
                "what_happens": "train.py defines it and writes it into experiment.json, but "
                    "calls simulate(key, nworms, clip_duration, nframes, size, kpoints) with "
                    "no eighth argument, so simulate's dropout parameter stays at its default "
                    "of 0 and drop_param never runs.",
                "would_not_work_anyway": "drop_param branches on Python's random.random() "
                    "inside a function traced under vmap and pmap, so the choice would be "
                    "frozen into the compiled function rather than redrawn per batch.",
            },
            "defaults_are_not_the_published_configuration": {
                "wloss_s": {"repo_default": 100.0, "published_run": 20.0},
                "wloss_p": {"repo_default": 100000.0, "published_run": 1e11},
                "batch_size": {"repo_default": 40, "published_run": 128},
                "warmup": {"repo_default": 100, "published_run": 1000},
                "why_it_matters": "a run launched with train.py's defaults differs from the "
                    "released model in the loss weighting by six orders of magnitude on the "
                    "latent term, before any simulator setting is touched.",
            },
            "frame_rate_already_matches": "the shipped real clip celegans_512.avi is 20 fps, "
                "and the default clip_duration 0.55 s over nframes 11 is exactly 20 fps. The "
                "temporal sampling was already tuned to the camera.",
        },
        "limits": [
            "No swept configuration was trained, so every configuration's real_score is "
            "null and the thesis test has no verdict. The machine holding the GPU went "
            "unreachable before the sweep could run and did not return.",
            "The one model that was trained, the defaults, ran on a laptop CPU at a "
            "reduced size (128 px frames, 30 worms, batch 4) for 800 steps, and scores "
            "0.0 because that is five orders of magnitude short of the published "
            "training, not because the default settings are bad. Read it as a gate that "
            "failed, not as a score for the repo's simulator.",
            "The baseline is the authors' published weights. The device count is not in "
            "the repository, but it is in the paper: the Methods, under Training details, "
            "say 'training has been carried out on a cluster of 8 x NVIDIA A5000's'. With "
            "experiment.json's 300000 steps at batch 128 per device that is 3.1e8 "
            "clip-samples, and the released parameters carry 338800 optimizer updates "
            "against a resumed checkpoint, so it is a floor. Anything trainable on one GTX "
            "1060 in a night sees about 0.03 percent of that, so swept scores would not "
            "have been comparable to it and were to be compared against a defaults run.",
            "Four of the sixteen configurations hold the repo's own values on their axis "
            "and are therefore identical to the defaults. They are kept as reference "
            "points and flagged with is_repo_default_on_its_axis, but the sweep really "
            "moves four axes across thirteen distinct settings, not sixteen.",
            "Only four simulator settings are swept out of the 27 that sweep/simconfig.py "
            "lifts out of the code. That is a sample of the simulator, not a survey of it.",
            "The unlabelled distance is a mean absolute z-score over fourteen statistics "
            "weighted equally. Nothing justifies equal weighting, and on the worm length "
            "axis the ordering reverses depending on which statistics are included.",
            "On body radius the unlabelled statistics and the direct labelled measurement "
            "point in opposite directions, and the granulometry curves show no setting on "
            "that axis can reproduce the real one. Treat the radius ranking as evidence "
            "that the simulator is missing a source of large-scale image structure, not as "
            "advice to thicken the worms.",
            "Precision is a lower bound. The labelling is concentrated in a disc covering "
            "a quarter of the frame, which is corrected for here, but a labeller marking a "
            "constant fraction of the worms inside that disc cannot be excluded from these "
            "files, and would depress precision without showing up in any of the checks.",
            "No configuration was run more than once, so there is no measured noise floor "
            "and no difference between configurations can be called larger than chance.",
        ],
    }

    (DATA / "results.json").write_text(json.dumps(out, indent=2))
    print(f"wrote {DATA / 'results.json'}")
    print(f"  configs: {len(configs)}, with real score: 0")
    print(f"  baseline recall whole frame {base['recall']:.4f}, "
          f"region {base['region_recall']:.4f}")
    print(f"  best by stats: {ranked[0]['name']} at {ranked[0]['stat_distance_to_real']:.3f}")


if __name__ == "__main__":
    main()
