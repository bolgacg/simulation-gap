"""
Every setting of Kirkegaard's C. elegans simulator, in one place.

The repo exposes only nworms, clip_duration, nframes, size, kpoints and sim_dropout
as train.py flags. Everything that decides what a worm looks like and how it moves is
a literal inside celegans/simulation.py and celegans/clips.py. This module collects
those literals into a dataclass with the repo's own values as defaults, so a sweep can
vary them without editing the clone.

Defaults are copied verbatim from commit 7c9775d:
  simulation.sampling_params  for the physics
  clips.convert_to_clip and clips.video_synthesis  for the rendering
"""
from dataclasses import dataclass, asdict, fields
import json
import math


TWO_PI = 2 * math.pi


@dataclass
class SimConfig:
    # ---- body ----
    # Worm length in pixels. simulation.py: uniform(30, 45).
    L_low: float = 30.0
    L_high: float = 45.0

    # ---- undulation ----
    # Amplitude of the tangent-angle wave, radians. normal(1, 0.1).
    A_loc: float = 1.0
    A_scale: float = 0.1

    # Undulation period in seconds. normal(0.8, 0.1).
    T_loc: float = 0.8
    T_scale: float = 0.1

    # Wavenumber of the travelling wave along arclength s in [0,1].
    # Body waves along the animal = kw / 2pi. uniform(0, 2pi).
    kw_low: float = 0.0
    kw_high: float = TWO_PI

    # Wavenumber of the standing mode. normal(pi, 1).
    ku_loc: float = math.pi
    ku_scale: float = 1.0

    # Head/tail asymmetry: arclength is warped as s -> s**(1 + 0.5*(dr - 0.5)),
    # so dr = 0.5 is no warping. uniform(0.2, 0.8).
    dr_low: float = 0.2
    dr_high: float = 0.8

    # Spatial phase of the standing mode. normal(0, 0.1).
    phase_3_scale: float = 0.1

    # ---- hydrodynamics ----
    # Drag anisotropy, normal over tangential. abs(normal(4, 4) + 1).
    # Slender-body theory says about 1.5 to 2; the repo's prior is much wider.
    alpha_loc: float = 4.0
    alpha_scale: float = 4.0
    alpha_shift: float = 1.0

    # ---- rendering, clips.convert_to_clip ----
    # Worm radius in pixels at the thickest point.
    R: float = 0.8
    # Antialiasing falloff distance in pixels.
    eps: float = 0.3
    # Peak pixel value along the centreline. video_synthesis passes 0.7,
    # overriding convert_to_clip's own default of 0.9.
    px_spine: float = 0.7

    # ---- rendering, clips.video_synthesis ----
    # Flat plate background, drawn per clip. uniform(0.01, 0.2).
    bg_low: float = 0.01
    bg_high: float = 0.2

    # Static debris on the plate. Threshold drawn as normal(8, 2) and applied to
    # the cube of standard normal noise; higher threshold means less debris.
    objects: bool = True
    obj_threshold_loc: float = 8.0
    obj_threshold_scale: float = 2.0

    # Optical blur.
    blur_sigma: float = 1.5
    blur_kernel: int = 3

    # Sensor noise added to every clip, before train.py's own augmentation noise.
    noise_std: float = 0.01
    noise_mu: float = 0.0

    def to_json(self, path):
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2)

    @classmethod
    def from_json(cls, path):
        with open(path) as f:
            d = json.load(f)
        known = {f.name for f in fields(cls)}
        unknown = set(d) - known
        if unknown:
            raise ValueError(f"unknown SimConfig keys: {sorted(unknown)}")
        return cls(**d)

    def diff_from_default(self):
        """The settings that differ from the repo's own values."""
        base = SimConfig()
        return {
            f.name: getattr(self, f.name)
            for f in fields(self)
            if getattr(self, f.name) != getattr(base, f.name)
        }
