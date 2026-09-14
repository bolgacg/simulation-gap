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
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LABELS = os.path.join(HERE, "data", "labeled_data", "labels.json")
OUT = os.path.join(HERE, "data", "labelling_check.json")


def density_of(clip_name):
    """The stated worm density, read from the video name the crop came from."""
    m = re.search(r"D3-(\d+(?:_\d+)?)x", clip_name)
    return float(m.group(1).replace("_", ".")) if m else None


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

    with open(OUT, "w") as f:
        json.dump(result, f, indent=1)

    print(f"{len(labels)} clips, {total} labelled centrelines")
    for d in densities:
        print(f"  {d:>4}x  {len(per_density[d]):>3} clips  {np.mean(per_density[d]):>6.2f} labels per clip")
    print(f"slope {k:.2f} labels per unit density, R2 {r2:.3f} through the origin, r {r:.3f}")
    print("exhaustive" if exhaustive else "NOT exhaustive, precision is not reportable")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
