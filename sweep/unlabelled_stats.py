"""
Image statistics that use no labels at all, computed identically on real and
synthetic frames.

Why this file exists. sim_stats.py measures worm length and body width, and on the
real side those measurements need the hand labels to know where the worms are. That
is fine for describing the gap, but it is fatal for the study's actual question,
which is whether real statistics available WITHOUT labels can pick good simulator
settings. If the statistics need labels, the question is already answered by
assumption.

So everything here is computed from raw pixels:

  intensity quantiles      how bright the worms are against the plate
  gradient magnitude       how sharp the edges are
  granulometry             the size distribution of bright structures, obtained by
                           morphological opening with discs of growing radius. This
                           is the unlabelled stand-in for body width: opening with a
                           disc wider than a worm deletes it.

Density is matched by construction rather than controlled for. Real clips span
stated densities 1x to 13x; since labels sit in a disc covering 24.8 percent of the
frame, the full-frame worm count runs from about 5 to about 71. Synthetic clips are
generated across the same span and pooled, so the two pools are comparable.

Both sides go through the identical normalisation: real frames are inverted first
because real worms are dark on a bright plate and synthetic worms are bright on a
dark one, then both are scaled by their own 1st and 99th percentiles.
"""
import numpy as np
from scipy import ndimage

# Full-frame worm counts spanning the real 1x to 13x range.
DENSITY_LADDER = (5, 15, 30, 50, 70)

GRANULOMETRY_RADII = (1, 2, 3, 4, 6)


def normalise(frame):
    lo, hi = np.percentile(frame, 1), np.percentile(frame, 99)
    if hi - lo < 1e-9:
        return np.zeros_like(frame, dtype=np.float64)
    return (frame.astype(np.float64) - lo) / (hi - lo)


def prepare_real(frame):
    """Real frames are dark worms on a bright plate."""
    return normalise(255.0 - frame.astype(np.float64))


def prepare_synthetic(frame):
    """Synthetic frames are already bright worms on a dark plate."""
    return normalise(np.asarray(frame, dtype=np.float64))


def _disc(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r


def granulometry(img):
    """
    Share of total bright signal that survives an opening with a disc of radius r.

    A worm of half-width w vanishes once r exceeds w, so the curve falls where the
    bodies are. It needs no labels and no segmentation threshold beyond clipping
    negatives, which is why it stands in for the body width measurement.
    """
    base = np.clip(img, 0, None)
    total = base.sum()
    if total <= 0:
        return {f"open_r{r}": 0.0 for r in GRANULOMETRY_RADII}
    out = {}
    for r in GRANULOMETRY_RADII:
        opened = ndimage.grey_opening(base, footprint=_disc(r))
        out[f"open_r{r}"] = float(opened.sum() / total)
    return out


def frame_stats(img):
    """img must already be normalised and worm-bright."""
    gy, gx = np.gradient(img)
    grad = np.hypot(gx, gy)
    stats = {
        "q50": float(np.percentile(img, 50)),
        "q90": float(np.percentile(img, 90)),
        "q99": float(np.percentile(img, 99)),
        "fg_frac": float((img > 0.5).mean()),
        "grad_mean": float(grad.mean()),
        "grad_q99": float(np.percentile(grad, 99)),
    }
    stats.update(granulometry(img))
    return stats


STAT_KEYS = ["q50", "q90", "q99", "fg_frac", "grad_mean", "grad_q99"] + [
    f"open_r{r}" for r in GRANULOMETRY_RADII
]


def pool(frames_stats):
    """Mean and standard deviation of each statistic across a pool of frames."""
    mean = {k: float(np.mean([s[k] for s in frames_stats])) for k in STAT_KEYS}
    sd = {k: float(np.std([s[k] for s in frames_stats])) for k in STAT_KEYS}
    return {"mean": mean, "sd": sd, "n_frames": len(frames_stats)}


def distance(sim_pool, real_pool):
    """
    Standardised distance between two pools.

    Each statistic is divided by its spread across the real frames, so statistics on
    very different numeric scales contribute comparably, and the result is a mean
    absolute z-score. Lower means the synthetic images look more like the real ones.
    """
    terms = {}
    for k in STAT_KEYS:
        scale = real_pool["sd"][k]
        if scale < 1e-9:
            continue
        terms[k] = abs(sim_pool["mean"][k] - real_pool["mean"][k]) / scale
    return float(np.mean(list(terms.values()))), terms
