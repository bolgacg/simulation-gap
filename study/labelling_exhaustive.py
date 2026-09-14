"""Is the real evaluation set labelled exhaustively, or only partly?

This decides what the page is allowed to report. If a human labelled every worm
visible in each crop, then a detection with no label nearby is a false positive and
precision means something. If they labelled only some worms per crop, an unmatched
detection may well be a real worm nobody clicked, and precision would be a number
that looks like a failure rate while measuring the labelling effort instead.

The dataset ships no statement either way, so it is measured.

The test: the clips come from nine videos at stated worm densities from 1x to 13x.
If every worm in a crop is labelled, the number of labels per crop has to rise in
proportion to the density, and the line has to pass through the origin, because no
worms means no labels. Any fixed labelling quota per crop, or any "click a few of
them" rule, flattens that relationship.

A first attempt tried to find unlabelled worms directly, by thresholding each frame
at the intensity of its own labelled centrelines and counting connected components
with no label in them. That found many, but it is not evidence: at these densities
touching worms merge into one component and a faint mid-body fragments into several,
so the count reflects the threshold rather than the labelling. It is left out
deliberately rather than reported as a weak signal.

Run: python3 study/labelling_exhaustive.py
"""

import collections
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sweep"))

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LABELS = os.path.join(HERE, "data", "labeled_data", "labels.json")
OUT = os.path.join(HERE, "data", "labelling_check.json")


def density_of(clip_name):
    """The stated worm density, read from the video name the crop came from."""
    m = re.search(r"D3-(\d+(?:_\d+)?)x", clip_name)
    return float(m.group(1).replace("_", ".")) if m else None


def arclength(xs, ys):
    """Length of a hand-drawn centreline, summed along its own points."""
    return sum(math.dist((xs[i], ys[i]), (xs[i + 1], ys[i + 1])) for i in range(len(xs) - 1))


def length_coverage(labels):
    """What share of real worms the simulator can even produce.

    The simulator draws worm length uniformly between two bounds. A real worm outside
    those bounds is a worm the model was never shown, whatever else is tuned, so this
    is a limit on the whole approach rather than on any one configuration. The bounds
    are read from SimConfig rather than typed, so this number follows the simulator.

    It also splits by recording date, because the two dates in this dataset hold
    noticeably different worms and a single length setting cannot match both.
    """
    try:
        from simconfig import SimConfig
    except Exception:
        return None
    lo, hi = SimConfig().L_low, SimConfig().L_high

    lengths, by_date = [], collections.defaultdict(list)
    for clip, rec in labels.items():
        m = re.search(r"(\d{4}-\d{2}-\d{2})", clip)
        date = m.group(1) if m else "undated"
        for spline in rec["splines"]:
            xs, ys = spline["x"], spline["y"]
            if len(xs) < 2:
                continue
            L = arclength(xs, ys)
            lengths.append(L)
            by_date[date].append(L)
    if not lengths:
        return None
    lengths.sort()
    inside = [L for L in lengths if lo <= L <= hi]

    def pct_at(p):
        return round(float(lengths[int(round(p / 100 * (len(lengths) - 1)))]), 1)

    return {
        "what_it_measures": (
            "the share of hand-drawn real worms whose length falls inside the range the "
            "simulator draws from. A worm outside it is one the model was never shown."
        ),
        "simulator_length_range_px": [lo, hi],
        "measurable_worms": len(lengths),
        "inside_range": len(inside),
        "inside_range_pct": round(100.0 * len(inside) / len(lengths), 1),
        "real_length_px": {"median": round(float(np.median(lengths)), 1),
                           "p5": pct_at(5), "p95": pct_at(95)},
        "by_recording_date": {
            d: {"worms": len(v), "median_length_px": round(float(np.median(v)), 1)}
            for d, v in sorted(by_date.items()) if len(v) >= 20
        },
        "why_the_dates_matter": (
            "the two recording dates hold worms of different typical length, so there is no "
            "single length setting that matches both and the sweep is tuning against a mixture"
        ),
    }


def main():
    with open(LABELS) as f:
        labels = json.load(f)

    per_density = collections.defaultdict(list)
    for clip, rec in labels.items():
        d = density_of(clip)
        if d is not None:
            per_density[d].append(len(rec["splines"]))

    densities = np.array(sorted(per_density))
    means = np.array([float(np.mean(per_density[d])) for d in densities])

    # Proportional fit, forced through the origin. Exhaustive labelling predicts
    # labels = k * density with no intercept to hide behind.
    k = float((densities * means).sum() / (densities * densities).sum())
    predicted = k * densities
    ss_res = float(((means - predicted) ** 2).sum())
    ss_tot = float(((means - means.mean()) ** 2).sum())
    r2 = 1.0 - ss_res / ss_tot
    r = float(np.corrcoef(densities, means)[0, 1])

    total = sum(len(v["splines"]) for v in labels.values())
    exhaustive = r2 >= 0.9 and r >= 0.95

    result = {
        "question": "are the labelled clips labelled exhaustively, or only in part",
        "method": (
            "the clips come from videos at stated worm densities from 1x to 13x. "
            "Exhaustive labelling means labels per clip rise in proportion to density, "
            "on a line through the origin. A fixed quota per clip does not."
        ),
        "clips": len(labels),
        "labelled_centrelines": total,
        "labels_per_clip_by_density": {
            str(d): {"clips": len(per_density[d]), "mean_labels": round(float(np.mean(per_density[d])), 2)}
            for d in densities
        },
        "slope_labels_per_unit_density": round(k, 3),
        "r_squared_through_origin": round(r2, 4),
        "pearson_r": round(r, 4),
        "verdict_exhaustive": bool(exhaustive),
        "what_it_means_for_the_page": (
            "labelling tracks density closely enough to treat each crop as fully labelled, "
            "so an unmatched detection counts as a false positive and precision is reportable"
            if exhaustive else
            "labelling does not track density, so an unmatched detection may be an unlabelled "
            "worm. Precision is not reportable and the page must report recall and distance only."
        ),
    }

    cov = length_coverage(labels)
    if cov:
        result["simulator_length_coverage"] = cov

    with open(OUT, "w") as f:
        json.dump(result, f, indent=1)

    print(f"{len(labels)} clips, {total} labelled centrelines")
    for d in densities:
        print(f"  {d:>4}x  {len(per_density[d]):>3} clips  {np.mean(per_density[d]):>6.2f} labels per clip")
    print(f"slope {k:.2f} labels per unit density, R2 {r2:.3f} through the origin, r {r:.3f}")
    print("exhaustive" if exhaustive else "NOT exhaustive, precision is not reportable")
    if cov:
        print(f"simulator covers {cov['inside_range_pct']}% of real worm lengths "
              f"(range {cov['simulator_length_range_px'][0]} to {cov['simulator_length_range_px'][1]} px, "
              f"real median {cov['real_length_px']['median']} px)")
        for d, v in cov["by_recording_date"].items():
            print(f"  {d}: {v['worms']} worms, median {v['median_length_px']} px")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
