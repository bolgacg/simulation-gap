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


def crossing_scaling(labels):
    """Crossings between labelled worms against the number of labelled worms.

    This was written to test whether tangled worms are skipped, and it does not work.
    It is kept because the measurement is real and the reason it fails is worth stating.

    Two reasons it fails. First, by construction: if a labeller marks each worm with
    constant probability p, the labels are p*N and the crossings among them are p^2 times
    the true crossings, so p cancels out of the log-log slope entirely and the exponent is
    unchanged. Independent thinning multiplies every k-point statistic by p^k and leaves
    all scaling exponents alone, so this test has exactly zero power against a constant
    fraction, not merely limited power. Second, empirically: the fit has seven usable bins,
    two of which hold one and two crossing events, and its confidence interval contains the
    quadratic it was meant to distinguish from.

    The numbers are reported with that interval, and the page says the test settles
    nothing rather than quoting the point estimate as a pass.
    """
    def segments_of(spline):
        xs, ys = spline["x"], spline["y"]
        return [((xs[i], ys[i]), (xs[i + 1], ys[i + 1])) for i in range(len(xs) - 1)]

    def segments_cross(p1, p2, p3, p4):
        def side(a, b, c):
            return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
        d1, d2 = side(p3, p4, p1), side(p3, p4, p2)
        d3, d4 = side(p1, p2, p3), side(p1, p2, p4)
        return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))

    per = collections.defaultdict(lambda: {"clips": 0, "worms": 0, "crossings": 0})
    for clip, rec in labels.items():
        dn = density_of(clip)
        if dn is None:
            continue
        splines = [s for s in rec["splines"] if len(s["x"]) >= 2]
        row = per[dn]
        row["clips"] += 1
        row["worms"] += len(splines)
        segs = [segments_of(s) for s in splines]
        for i in range(len(segs)):
            for j in range(i + 1, len(segs)):
                if any(segments_cross(a[0], a[1], b[0], b[1]) for a in segs[i] for b in segs[j]):
                    row["crossings"] += 1

    xs, ys = [], []
    rows = {}
    for dn in sorted(per):
        r = per[dn]
        wpc, cpc = r["worms"] / r["clips"], r["crossings"] / r["clips"]
        rows[str(dn)] = {"clips": r["clips"], "worms_per_clip": round(wpc, 2),
                         "crossings_per_clip": round(cpc, 2)}
        if cpc > 0:
            xs.append(math.log(wpc))
            ys.append(math.log(cpc))
    if len(xs) < 3:
        return None
    n_pts = len(xs)
    A = np.vstack([np.array(xs), np.ones(n_pts)]).T
    beta = np.linalg.lstsq(A, np.array(ys), rcond=None)[0]
    slope = float(beta[0])
    resid = np.array(ys) - A @ beta
    se = float(np.sqrt((resid ** 2).sum() / (n_pts - 2) * np.linalg.inv(A.T @ A)[0, 0])) if n_pts > 2 else None
    # Student t for a 95 percent interval at n-2 degrees of freedom, for the small n here.
    tcrit = {3: 12.706, 4: 4.303, 5: 3.182, 6: 2.776, 7: 2.571, 8: 2.447, 9: 2.365}.get(n_pts, 2.0)
    ci = [round(slope - tcrit * se, 2), round(slope + tcrit * se, 2)] if se else None
    return {
        "what_it_measures": (
            "how the number of crossings between labelled worms grows with the number of "
            "labelled worms in a clip. Marking every worm regardless of difficulty makes "
            "crossings grow roughly as the square of the count, because every pair can cross. "
            "Skipping tangled worms would flatten that."
        ),
        "by_density": rows,
        "exponent": round(slope, 2),
        "exponent_95_interval": ci,
        "usable_bins": n_pts,
        "quadratic_would_be": 2.0,
        "settles_anything": bool(ci and (ci[0] > 2.0 or ci[1] < 2.0)),
        "why_it_settles_nothing": (
            "the interval contains the quadratic it was meant to distinguish from, and even if it "
            "did not, independent thinning preserves the exponent exactly, so this statistic cannot "
            "see a constant fraction at all"
        ),
    }


def label_region(labels, size=256):
    """Where in each crop the labels actually are.

    This is the test that works, and it found something. Sub-region labelling, meaning
    marking the middle of a crop and ignoring the edges, produces a line through the
    origin like exhaustive labelling and produces quadratic crossing growth like
    exhaustive labelling, so neither earlier test can see it. It is visible directly.

    It matters more than the others because of what it does to precision: detections are
    counted across the whole frame while labels exist only where someone drew them, so
    every correct detection outside the labelled region is recorded as a false positive.
    """
    xs, ys = [], []
    for rec in labels.values():
        for spline in rec["splines"]:
            if len(spline["x"]) < 2:
                continue
            xs.extend(spline["x"])
            ys.extend(spline["y"])
    if not xs:
        return None
    xs, ys = np.array(xs), np.array(ys)
    boxes = []
    for half in (56, 64, 72, 80):
        lo, hi = size / 2 - half, size / 2 + half
        inside = float(((xs >= lo) & (xs <= hi) & (ys >= lo) & (ys <= hi)).mean())
        boxes.append({
            "box_px": [round(lo), round(hi)],
            "side_px": 2 * half,
            "area_share_pct": round(100.0 * (2 * half / size) ** 2, 1),
            "points_inside_pct": round(100.0 * inside, 1),
        })
    chosen = next((b for b in boxes if b["points_inside_pct"] >= 97.0), boxes[-1])
    return {
        "what_it_measures": (
            "the share of hand-clicked points falling inside a central box of each crop. "
            "Labelling confined to the middle passes both of the other tests and is invisible "
            "to them."
        ),
        "frame_px": size,
        "boxes": boxes,
        "smallest_box_holding_97_pct": chosen,
        "consequence_for_precision": (
            "detections are counted over the whole frame while labels exist only in part of it, "
            "so a correct detection outside the labelled region is scored as a false positive. "
            "Precision over the whole frame is therefore an underestimate by roughly the ratio "
            "of frame area to labelled area, and the only fix is to score detections inside the "
            "labelled region alone."
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
        "verdict_exhaustive_caveat": (
            "proportionality is consistent with exhaustive labelling and rules out a fixed quota, "
            "but it cannot rule out a constant fraction, so precision is a lower bound"
        ),
        "what_it_means_for_the_page": (
            "labelling tracks density closely enough to treat each crop as fully labelled, "
            "so an unmatched detection counts as a false positive and precision is reportable"
            if exhaustive else
            "labelling does not track density, so an unmatched detection may be an unlabelled "
            "worm. Precision is not reportable and the page must report recall and distance only."
        ),
    }

    crossings = crossing_scaling(labels)
    if crossings:
        result["crossing_scaling"] = crossings

    region = label_region(labels)
    if region:
        result["label_region"] = region

    # What the two tests together do and do not establish. Stated here rather than on
    # the page, so the page quotes it instead of paraphrasing it.
    result["what_is_ruled_out"] = [
        "a fixed number of labels per clip, because labels rise in proportion to density",
    ]
    result["what_is_not_ruled_out"] = [
        ("labelling a constant fraction of the worms, chosen independently of context. That "
         "produces a line through the origin with a smaller slope and an equally good fit, and "
         "it also leaves every scaling exponent unchanged, so no pair statistic can see it "
         "either. It is not ruled out and cannot be, from these files."),
        ("skipping the tangled worms. The crossing test written for this does not settle it: "
         "its interval contains the quadratic it was meant to distinguish from."),
    ]
    if region:
        result["what_was_found_instead"] = (
            "the labels are not spread over the crop. " +
            str(region["smallest_box_holding_97_pct"]["points_inside_pct"]) +
            " percent of every clicked point falls inside a central " +
            str(region["smallest_box_holding_97_pct"]["side_px"]) + " pixel box, which is " +
            str(region["smallest_box_holding_97_pct"]["area_share_pct"]) +
            " percent of the frame. Detections are counted over the whole frame, so precision "
            "measured this way counts correct detections in the unlabelled majority as false "
            "positives."
        )

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
