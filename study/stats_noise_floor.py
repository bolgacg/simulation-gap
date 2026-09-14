#!/usr/bin/env python3
"""How much of the unlabelled ranking survives redrawing the synthetic worms.

Why this exists. Act three ranks sixteen configurations by a distance between
synthetic and real image statistics, and then reads findings off that ordering.
The distance is computed on a pool of synthetic clips drawn from a seed, so part
of every gap is the draw rather than the setting. Nothing on the page could tell
those apart until the sweep was run again on two more seeds.

The measurement is clean because five of the configurations hold the repository's
own value on their own axis and are therefore the same simulator settings under
different names. Within one seed they score identically, to the digit. Across
seeds they move together. So the spread of any one configuration across seeds is
resampling noise with the setting held fixed, which is exactly the floor a gap
between two settings has to clear.

The comparison is paired. The same seed draws the pool for every configuration
and scores it against the same real footage, and the draw moves the whole field
together, so the difference between two settings is taken inside each draw and
only then summarised. Differencing across draws would charge a shared shift to
the setting. An axis reports a direction only if every setting on it stays on
the same side of the repository's value in every draw, the repository's position
on the axis is the same every time, and at least one difference is more than
three times the scatter of its own paired difference.

Run: python3 study/stats_noise_floor.py
Writes: data/stats_noise_floor.json
"""
from __future__ import annotations

import json
import statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNS = {
    0: ROOT / "data" / "stats_sweep.json",
    1: ROOT / "data" / "stats_sweep_seed1.json",
    2: ROOT / "data" / "stats_sweep_seed2.json",
}


def main() -> int:
    have = {s: p for s, p in RUNS.items() if p.exists()}
    if len(have) < 2:
        print("need at least two seeds of the statistics sweep; found "
              f"{len(have)} ({', '.join(p.name for p in have.values())})")
        return 1

    runs, axis_of, value_of = {}, {}, {}
    for s, p in have.items():
        d = json.loads(p.read_text())
        runs[s] = {c["name"]: c["stat_distance_to_real"] for c in d["configs"]}
        for c in d["configs"]:
            axis_of.setdefault(c["name"], c.get("axis"))
            value_of.setdefault(c["name"], c.get("axis_value"))

    # The axis a configuration belongs to is recorded as "defaults" in the sweep
    # output when it holds the repository's own value, so take the axis from
    # results.json where it is kept properly.
    res = ROOT / "data" / "results.json"
    repo_default_on = {}
    if res.exists():
        for c in json.loads(res.read_text()).get("configs") or []:
            axis_of[c["name"]] = c.get("axis")
            value_of[c["name"]] = c.get("axis_value")
            if c.get("is_repo_default_on_its_axis"):
                repo_default_on[c["axis"]] = c["name"]

    seeds = sorted(runs)
    names = [n for n in runs[seeds[0]] if all(n in runs[s] for s in seeds)]
    per = {}
    for n in names:
        v = [runs[s][n] for s in seeds]
        per[n] = {"axis": axis_of.get(n), "axis_value": value_of.get(n),
                  "by_seed": {str(s): runs[s][n] for s in seeds},
                  "mean": st.mean(v), "sd": st.pstdev(v),
                  "min": min(v), "max": max(v)}
    ranks = {}
    for s in seeds:
        order = sorted(names, key=lambda n: runs[s][n])
        for i, n in enumerate(order):
            ranks.setdefault(n, {})[str(s)] = i + 1
    for n in names:
        per[n]["rank_by_seed"] = ranks[n]
        per[n]["rank_range"] = [min(ranks[n].values()), max(ranks[n].values())]

    floor = st.median([per[n]["sd"] for n in names])

    # Every configuration moves the same way between draws. Seed 0 puts the whole
    # field further from real than seed 1 does, for the settings and the defaults
    # alike, so most of that spread is a property of the draw and not of any
    # comparison made inside one draw. This is why the axis tests below difference
    # against the repository's value WITHIN each draw rather than across draws.
    field = {str(s): st.mean([runs[s][n] for n in names]) for s in seeds}
    # How much of a configuration's spread across draws is the shared shift: take the
    # spread again after subtracting each draw's own field mean and see what is left.
    raw_sd = st.mean([st.pstdev([runs[s][n] for s in seeds]) for n in names])
    centred_sd = st.mean([st.pstdev([runs[s][n] - field[str(s)] for s in seeds]) for n in names])
    common_shift = {
        "mean_distance_by_seed": field,
        "range": max(field.values()) - min(field.values()),
        "per_config_sd": raw_sd,
        "per_config_sd_after_removing_the_shift": centred_sd,
        "common_random_numbers": "the pairing is the simulator's own design rather than a "
            "choice made here. synthetic_pool builds one key from the seed and the replacement "
            "sampler splits it in the same fixed order whatever the configuration holds, so a "
            "configuration changes the bounds of a draw and never the draw itself. The same "
            "variate becomes worm i under every configuration, in the same place and moving the "
            "same way, differing only in the length or thickness or drag it is drawn with. "
            "Anyone rebuilding this has to hold the seed fixed across configurations: vary it "
            "per configuration and the pairing is gone and the effect disappears into the draw.",
        "what_it_shows": "the draw moves every configuration together. The spread of a single "
                         "configuration across draws is therefore mostly a shift shared by all "
                         "of them, and differencing two configurations inside one draw removes "
                         "it. The same seed generates both pools, so the comparison is paired.",
    }

    # The duplicate configurations are the cleanest read on the floor, because
    # they are the same settings under different names.
    dup = [n for n in names if axis_of.get(n) and repo_default_on.get(axis_of[n]) == n]
    dup_note = None
    if len(dup) > 1:
        within = [st.pstdev([runs[s][n] for n in dup]) for s in seeds]
        dup_note = {
            "configs": dup,
            "spread_within_a_seed": max(within),
            "what_it_shows": "these configurations hold the repository's own value on their "
                             "own axis, so they are the same simulator under different names. "
                             "Within one seed they agree to the digit, which is why the spread "
                             "across seeds can be read as the draw and nothing else.",
        }

    # Every claim act three makes about an axis is a claim about where the
    # repository's own value sits among the settings tested on that axis. So that
    # is what is checked: the repo value's position on its own axis, in each seed
    # separately, and how far the nearest setting is from it against the floor.
    claims = []
    for axis, repo_name in sorted(repo_default_on.items()):
        on_axis = [n for n in names if axis_of.get(n) == axis]
        if repo_name not in on_axis or len(on_axis) < 2:
            continue
        pos = {}
        for s in seeds:
            order = sorted(on_axis, key=lambda n: runs[s][n])
            pos[str(s)] = order.index(repo_name) + 1
        stable_position = len(set(pos.values())) == 1
        beats_repo = [n for n in on_axis
                      if n != repo_name and all(runs[s][n] < runs[s][repo_name] for s in seeds)]
        loses_to_repo = [n for n in on_axis
                         if n != repo_name and all(runs[s][n] > runs[s][repo_name] for s in seeds)]
        flips = [n for n in on_axis if n != repo_name
                 and n not in beats_repo and n not in loses_to_repo]

        def gap_entry(n):
            # Paired: the same seed draws both pools and scores them against the same
            # real footage, so the difference is taken inside each draw and then
            # summarised, rather than differencing two numbers that each carry the
            # draw's shared shift.
            diffs = [runs[s][repo_name] - runs[s][n] for s in seeds]
            m, sd = st.mean(diffs), st.pstdev(diffs)
            same_sign = all(x > 0 for x in diffs) or all(x < 0 for x in diffs)
            return {"config": n, "value": value_of.get(n),
                    "difference_from_repo_by_seed": {str(s): d for s, d in zip(seeds, diffs)},
                    "mean_gap_to_repo": m, "sd_of_paired_difference": sd,
                    "same_sign_in_every_draw": same_sign,
                    "gap_over_its_own_scatter": (abs(m) / sd) if sd else None,
                    "gap_over_unpaired_floor": (m / floor) if floor else None,
                    "rank_by_seed": per[n]["rank_by_seed"]}

        nearest = max((gap_entry(n) for n in beats_repo),
                      key=lambda e: e["mean_gap_to_repo"], default=None)
        others = [gap_entry(n) for n in on_axis if n != repo_name]
        # An axis reports a direction only if every setting on it keeps its side of
        # the repository's value in every draw, and at least one of them does so by
        # more than the scatter of its own paired difference.
        consistent = bool(others) and all(e["same_sign_in_every_draw"] for e in others)
        decisive = any((e["gap_over_its_own_scatter"] or 0) > 3 for e in others)
        survives = bool(stable_position and consistent and decisive)
        claims.append({
            "axis": axis,
            "repo_config": repo_name,
            "repo_value": value_of.get(repo_name),
            "settings_tested_on_axis": len(on_axis),
            "repo_position_on_axis_by_seed": pos,
            "repo_position_is_stable": stable_position,
            "beats_repo_in_every_seed": [gap_entry(n) for n in beats_repo],
            "loses_to_repo_in_every_seed": [gap_entry(n) for n in loses_to_repo],
            "changes_side_between_seeds": [gap_entry(n) for n in flips],
            "every_setting_keeps_its_side": consistent,
            "strongest_gap": nearest,
            "survives_reseeding": survives,
        })

    out = {
        "what": "the same sixteen configurations scored against the same real footage with the "
                "synthetic clips redrawn from a different seed each time. Nothing about the "
                "simulator settings changes between runs, only the draw.",
        "seeds": seeds,
        "noise_floor_sd": floor,
        "how_to_read_the_floor": "the typical standard deviation of one configuration's distance "
                                 "across the seeds. A gap between two settings smaller than this "
                                 "is the draw talking.",
        "common_shift_between_draws": common_shift,
        "identical_configurations": dup_note,
        "per_config": per,
        "axis_claims": claims,
        "survives": [c["axis"] for c in claims if c["survives_reseeding"]],
        "does_not_survive": [c["axis"] for c in claims if not c["survives_reseeding"]],
    }
    (ROOT / "data" / "stats_noise_floor.json").write_text(json.dumps(out, indent=1))

    print(f"noise floor, one configuration across {len(seeds)} seeds: sd {floor:.3f}")
    for c in claims:
        n = c["strongest_gap"]
        print(f"  {c['axis']:16} repo value {c['repo_value']} sits "
              f"{list(c['repo_position_on_axis_by_seed'].values())} of "
              f"{c['settings_tested_on_axis']} across the seeds, "
              f"{len(c['beats_repo_in_every_seed'])} settings beat it every time"
              + (f", best by {n['mean_gap_to_repo']:+.3f} with a paired scatter of "
                 f"{n['sd_of_paired_difference']:.3f}" if n else "")
              + f", {len(c['changes_side_between_seeds'])} change side "
              f"-> {'SURVIVES' if c['survives_reseeding'] else 'DOES NOT SURVIVE'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
