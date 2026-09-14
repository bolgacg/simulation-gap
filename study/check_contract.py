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
    "limits": "the limits box falls back to generic wording",
}

# Not in results.json. build_page_data.py folds these in from their own files, so the
# check is that the file exists rather than that the key is present.
SIDE_FILES = {
    "data/labelling_check.json": "the page cannot say whether precision is reportable, so it will not quote precision",
    "data/baseline_real.json": "the browser self-check cannot re-add the baseline from its per-clip counts",
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
