"""Check results.json against the fields the page actually reads.

Why this exists. The page renders "n/a" or an empty string when a field it expects
is absent, which looks exactly like a measurement that came out empty. On the other
page in this campaign that happened twice: a hand-check of twenty labels showed as
"n/a" because the page read ta.checked where the data wrote hand_checked, and a list
of 326 organisations showed none as already connected because the page read
shares_project_with_au where the data wrote shares_a_project_with_au_on_this_topic.
Both survived several verification passes, because a page full of "n/a" renders
perfectly and passes every layout and script check there is.

So the fields are listed here and checked before the page is built. A missing field
is reported loudly. It does not stop the build, because a page that honestly says a
thing was not recorded is better than no page, but nobody gets to find out about it
from the rendered output.

Run: python3 study/check_contract.py
Also run automatically by study/build_page_data.py.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# path -> whether the page can honestly render without it
REQUIRED = {
    "generated_at": True,
    "repo.url": True,
    "repo.commit": True,
    "real_data.source": True,
    "real_data.url": True,
    "real_data.clips": True,
    "real_data.worms_labelled": True,
    "metric.what_it_measures": True,
    "metric.cutoff_px": True,
    "hardware.where": True,
    "hardware.gpu": True,
    "hardware.backend": True,
    "baseline.real_score": True,
    "defaults_run.real_score": True,
    "configs": True,
    "axes": True,
    "thesis_test": True,
}

OPTIONAL = {
    "training.train_steps": "the model card will print 'not recorded' for the schedule",
    "training.batch_size": "the model card will print 'not recorded' for the schedule",
    "training.identical_across_runs": "the model card cannot state that runs share a schedule",
    "defaults_run.learning_curve": "act one will show no learning curve, so nothing on the page says whether the schedule was long enough to learn",
    "defaults_run.not_achievable_because": "act one cannot say WHY the learning curve is flat, so a reader cannot tell a schedule that was chosen too short from a machine that never came back",
    "defaults_run.repeats": "act two cannot separate a real difference between settings from run-to-run chance, so it will refuse to say which setting is worth tuning and will call the ordering a lead rather than a finding",
    "limits": "the limits box falls back to generic wording",
    "statistics_only_finding.radius_axis_warning": "act three loses its sting entirely: the verdict box above the granulometry chart goes blank and the chart is left with no claim to be evidence for",
    "statistics_only_finding.noise_axis_CLEARS_the_floor": "act three loses the one axis where the authors' own choice is shown to sit at a minimum, which is the only positive result the statistics half produces",
    "statistics_only_finding.radius_axis_CLEARS_the_floor": "act three states the radius warning without the evidence that the ordering behind it survives redrawing the worms, so a reader cannot tell it from the two axes that do not",
    "statistics_only_finding.length_axis_NEEDED_a_bigger_pool": "the page drops the axis that shows why pool size matters: flat on ten clips per configuration, ordered on fifty, which is the difference between unresolved and absent",
    "statistics_only_finding.motion_axis_DOES_NOT_clear_the_floor": "the page loses the sharpest negative it has, that the statistics cannot see the one parameter the simulator gets physically wrong",
    "simulator_findings.drag_anisotropy_prior_is_unphysical": "the reading-the-simulator section loses the one finding of its five that the sweep can actually reach, and its opening sentence silently changes to a weaker claim",
    "simulator_findings.wave_amplitude_is_gated_at_a_fixed_rate": "the section loses the clearest case of a defect that no setting can move, which is the whole reason the section exists",
    "simulator_findings.a_flag_that_does_nothing": "the section loses the dead --sim_dropout flag",
    "simulator_findings.defaults_are_not_the_published_configuration": "the section loses the table showing that a run started from the repository defaults differs from the released model before any simulator setting is touched",
    "simulator_findings.frame_rate_already_matches": "the section becomes a list of criticisms with nothing the simulator gets right, which misrepresents it",
    "hardware.startup_seconds": "the method section cannot say how much of a run is compilation, which is the fact that decides how a sweep should be shaped on one card",
    "hardware.seconds_per_step": "same as above; both are needed together",
}

# Not in results.json. build_page_data.py folds these in from their own files, so the
# check is that the file exists rather than that the key is present.
SIDE_FILES = {
    "data/labelling_check.json": "the page cannot say whether precision is reportable, so it will not quote precision",
    "data/baseline_real.json": "the browser self-check cannot re-add the baseline from its per-clip counts",
    "data/stats_noise_floor.json": "act three shows no repeat measurement, so the axis table disappears and the page says the statistics were computed once and no ordering on them should be read as a finding",
}

CONFIG_FIELDS = ["name", "axis", "axis_value", "real_score"]


def get(d, path):
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None, False
        cur = cur[part]
    return cur, True


def main() -> int:
    src = os.path.join(HERE, "data", "results.json")
    if not os.path.exists(src):
        print(f"no results.json at {src}")
        return 2
    d = json.loads(open(src).read())

    missing, empty_optional, notes = [], [], []

    for path in REQUIRED:
        val, present = get(d, path)
        if not present or val is None:
            missing.append(path)

    for path, consequence in OPTIONAL.items():
        val, present = get(d, path)
        if not present or val is None or val == [] or val == {}:
            empty_optional.append((path, consequence))

    for rel, consequence in SIDE_FILES.items():
        if not os.path.exists(os.path.join(HERE, rel)):
            empty_optional.append((rel, consequence))

    cfgs = d.get("configs") or []
    if cfgs:
        for f in CONFIG_FIELDS:
            absent = [c.get("name", "?") for c in cfgs if f not in c]
            if absent:
                missing.append(f"configs[].{f} (absent on {len(absent)} of {len(cfgs)})")
        unfinished = [c for c in cfgs if c.get("real_score") is None]
        unexplained = [c.get("name", "?") for c in unfinished if not c.get("failed_because")]
        if unexplained:
            notes.append(
                f"{len(unexplained)} configuration{'s' if len(unexplained) != 1 else ''} "
                f"{'have' if len(unexplained) != 1 else 'has'} no score and no failed_because. "
                "The page says unfinished runs are recorded as unfinished rather than as a "
                "low score, and that sentence needs the reason to be true: "
                + ", ".join(unexplained[:6])
            )

    ax = d.get("axes") or []
    if ax and not any("default_value" in a for a in ax):
        empty_optional.append(("axes[].default_value",
                               "the sweep chart cannot mark the value the authors chose"))

    tr, _ = get(d, "training.identical_across_runs")
    if tr is False:
        notes.append(
            "training.identical_across_runs is false. The sweep is then comparing training "
            "problems rather than simulator settings, and the page must say so before any "
            "difference between configurations is reported as a finding."
        )

    print(f"results.json: {len(cfgs)} configurations, "
          f"{len([c for c in cfgs if c.get('real_score') is not None])} scored")
    if missing:
        print("\nMISSING, and the page needs these:")
        for m in missing:
            print(f"  {m}")
    if empty_optional:
        print("\nAbsent, and here is what the reader will see instead:")
        for path, consequence in empty_optional:
            print(f"  {path}: {consequence}")
    if notes:
        print("\nWorth acting on:")
        for nt in notes:
            print(f"  {nt}")
    if not (missing or empty_optional or notes):
        print("every field the page reads is present")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
