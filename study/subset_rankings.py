#!/usr/bin/env python3
"""Does the answer depend on which statistics are in the distance?

Why this exists. The unlabelled distance is a mean absolute z-score over fourteen
statistics weighted equally. Nothing justifies equal weighting, so the ordering it
produces is a choice as much as a measurement, and the way to show that is to
compute the same ordering from defensible subsets and see whether they agree.

The subsets are the three natural groups in the fourteen: what a single frame
looks like, the size curve from morphological openings, and what changes between
frames. Each is something a laboratory might reasonably measure on its own.

Every comparison is paired inside a draw and then averaged, for the reason act
three gives: the same seed draws the pool for every configuration, so a setting
is compared against the repository's value on the same worms. A subset is
reported as having a direction only when the paired difference keeps its sign in
every draw.

Run: python3 study/subset_rankings.py
Writes: data/subset_rankings.json
"""
from __future__ import annotations

import json
import statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

POOLS = {
    10: [ROOT / "data" / "stats_sweep.json",
         ROOT / "data" / "stats_sweep_seed1.json",
         ROOT / "data" / "stats_sweep_seed2.json"],
    50: [ROOT / "data" / f"stats_pool50_seed{s}.json" for s in (0, 1, 2)],
}

SUBSETS = {
    "all": {"label": "all fourteen, weighted equally", "keys": None},
    "spatial": {"label": "what one frame looks like",
                "keys": ["q50", "q90", "q99", "fg_frac", "grad_mean", "grad_q99"]},
    "granulometry": {"label": "the size curve from openings",
                     "keys": ["open_r1", "open_r2", "open_r3", "open_r4", "open_r6"]},
    "motion": {"label": "what changes between frames",
               "keys": ["frame_diff_mean", "frame_diff_over_sd", "frame_corr"]},
}


def distance(cfg, keys):
    z = cfg["per_statistic_z"]
    return st.mean(abs(z[k]) for k in (keys or list(z)))


def main() -> int:
    out = {
        "what": "the same configurations ranked again using only part of the distance, to show "
                "whether the answer is a measurement or a weighting choice",
        "how": "paired inside each draw against the repository's value on the same axis, then "
               "averaged over draws. A subset has a direction only if the sign holds in every draw.",
        "subsets": {k: v["label"] for k, v in SUBSETS.items()},
        "pools": {},
    }

    for pool, files in POOLS.items():
        have = [f for f in files if f.exists()]
        if len(have) < 2:
            continue
        runs = [{c["name"]: c for c in json.loads(f.read_text())["configs"]} for f in have]
        axes = {}
        # Which configurations sit on each axis, and which holds the repo value.
        res = ROOT / "data" / "results.json"
        if not res.exists():
            print("results.json is needed for the axis labels")
            return 1
        cfgs = json.loads(res.read_text()).get("configs") or []
        for c in cfgs:
            axes.setdefault(c["axis"], {"repo": None, "others": []})
            if c.get("is_repo_default_on_its_axis"):
                axes[c["axis"]]["repo"] = c["name"]
            else:
                axes[c["axis"]]["others"].append((c["name"], c.get("axis_value")))

        pool_out = {}
        for axis, members in sorted(axes.items()):
            if not members["repo"] or not members["others"]:
                continue
            repo_value = next((c.get("axis_value") for c in cfgs
                               if c["name"] == members["repo"]), None)
            per_subset = {}
            for key, spec in SUBSETS.items():
                entries = []
                for name, value in sorted(members["others"], key=lambda x: x[1] or 0):
                    diffs = [distance(r[members["repo"]], spec["keys"]) - distance(r[name], spec["keys"])
                             for r in runs if name in r and members["repo"] in r]
                    if len(diffs) < 2:
                        continue
                    m = st.mean(diffs)
                    entries.append({
                        "config": name, "value": value, "mean_gap_to_repo": m,
                        "sd": st.pstdev(diffs),
                        "same_sign_in_every_draw": min(diffs) * max(diffs) > 0,
                    })
                if not entries:
                    continue
                best = max(entries, key=lambda e: e["mean_gap_to_repo"])
                consistent = all(e["same_sign_in_every_draw"] for e in entries)
                wins = best["mean_gap_to_repo"] > 0
                per_subset[key] = {
                    "entries": entries,
                    "prefers": best["config"] if wins else members["repo"],
                    "prefers_value": best["value"] if wins else repo_value,
                    "prefers_the_repo_value": not wins,
                    "every_setting_keeps_its_side": consistent,
                }
            # A subset disagrees only when it points to the OTHER SIDE of the repository's
            # value, not merely to a different setting on the same side. Preferring 1.2
            # where the full distance prefers 1.6 is the same answer, thicker.
            def side(v):
                if v is None or repo_value is None:
                    return 0
                return (v > repo_value) - (v < repo_value)
            full = per_subset.get("all", {}).get("prefers_value")
            disagree = [k for k, v in per_subset.items()
                        if k != "all" and v.get("every_setting_keeps_its_side")
                        and side(v.get("prefers_value")) and side(full)
                        and side(v["prefers_value"]) != side(full)]
            pool_out[axis] = {
                "by_subset": per_subset,
                "full_distance_prefers": full,
                "subsets_that_point_elsewhere": disagree,
                "answer_depends_on_weighting": bool(disagree),
            }
        out["pools"][str(pool)] = pool_out

    (ROOT / "data" / "subset_rankings.json").write_text(json.dumps(out, indent=1))
    for pool, axes in out["pools"].items():
        print(f"pool of {pool} clips:")
        for axis, a in axes.items():
            bits = []
            for k, v in a["by_subset"].items():
                bits.append(f"{k}->{v['prefers_value']}" +
                            ("" if v["every_setting_keeps_its_side"] else "?"))
            print(f"  {axis:16} {' '.join(bits)}"
                  f"{'   WEIGHTING DECIDES' if a['answer_depends_on_weighting'] else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
