"""
Apply a SimConfig to the deeptangle simulator without editing the clone.

Two functions in the repo hold the settings we want to sweep:

  celegans.simulation.sampling_params(key, nworms, box_size)
      draws the per-worm physics parameters. simulate() and sim_pca() both look it
      up as a module global at call time, so replacing the module attribute is
      enough to change both.

  celegans.clips.video_synthesis(key, w, size)
      turns coordinates into pixels. train.py does `from celegans import
      video_synthesis`, binding the name in train's namespace, so that reference
      has to be replaced too. apply() does both.

Nothing here writes to the clone.
"""
from functools import partial

import jax
import jax.numpy as jnp
import jax.random as jr

from celegans import clips as _clips
from celegans import simulation as _simulation
from celegans import transforms as _transforms

from simconfig import SimConfig


def make_sampling_params(cfg: SimConfig):
    """A drop-in replacement for celegans.simulation.sampling_params."""

    def sampling_params(key, nworms, box_size):
        def normal(key, loc, scale):
            key, sample_key = jax.random.split(key)
            return key, loc + jax.random.normal(sample_key, shape=(nworms,)) * scale

        def uniform(key, low, high):
            key, sample_key = jax.random.split(key)
            return key, jax.random.uniform(sample_key, shape=(nworms,), minval=low, maxval=high)

        params = {}
        key, params["L"] = uniform(key, cfg.L_low, cfg.L_high)

        key, params["A"] = normal(key, cfg.A_loc, cfg.A_scale)
        key, params["T"] = normal(key, cfg.T_loc, cfg.T_scale)
        key, params["kw"] = uniform(key, cfg.kw_low, cfg.kw_high)
        key, params["ku"] = normal(key, cfg.ku_loc, cfg.ku_scale)

        key, params["inc"] = uniform(key, 0.0, 2 * jnp.pi)
        key, params["dr"] = uniform(key, cfg.dr_low, cfg.dr_high)
        key, params["phase_1"] = uniform(key, 0.0, 2 * jnp.pi)
        key, params["phase_2"] = uniform(key, 0.0, 2 * jnp.pi)
        key, params["phase_3"] = normal(key, 0.0, cfg.phase_3_scale)
        key, params["alpha"] = normal(key, cfg.alpha_loc, cfg.alpha_scale)
        params["alpha"] = jnp.abs(params["alpha"] + cfg.alpha_shift)

        half_box = box_size // 2
        key, params["x0"] = uniform(key, -half_box, half_box)
        key, params["y0"] = uniform(key, -half_box, half_box)
        return params

    return sampling_params


def make_video_synthesis(cfg: SimConfig):
    """A drop-in replacement for celegans.clips.video_synthesis."""

    def video_synthesis(key, w, size):
        bg_rng, fg_rng = jr.split(key, 2)
        bg_rngs = jr.split(bg_rng, 4)
        fg_rngs = jr.split(fg_rng, 2)

        background_value = jr.uniform(bg_rngs[0], shape=(), minval=cfg.bg_low, maxval=cfg.bg_high)
        object_threshold = jr.normal(bg_rngs[1], shape=()) * cfg.obj_threshold_scale + cfg.obj_threshold_loc

        transformations = [lambda image: _transforms.add_channel(image)]
        if cfg.objects:
            transformations.append(
                lambda image: _transforms.add_static_objects(
                    bg_rngs[2], image, size, threshold=object_threshold
                )
            )
        transformations += [
            lambda image: _transforms.gaussian_blur(
                image, sigma=cfg.blur_sigma, kernel_size=cfg.blur_kernel
            ),
            lambda image: _transforms.apply_white_noise(
                fg_rngs[0], image, mu=cfg.noise_mu, std=cfg.noise_std, p=1
            ),
            lambda image: _transforms.remove_channel(image),
        ]

        background = jnp.full(shape=(size, size), fill_value=background_value)
        clip = _clips.convert_to_clip(w, size, R=cfg.R, eps=cfg.eps, px_spine=cfg.px_spine)
        clip = jnp.maximum(clip, background)
        for transform in transformations:
            clip = transform(clip)
        return clip

    return video_synthesis


def apply(cfg: SimConfig, also_patch=()):
    """
    Install cfg into the already-imported celegans modules.

    also_patch: extra module objects that did `from celegans import video_synthesis`
    and therefore hold their own reference to it. Pass the train module.
    """
    sp = make_sampling_params(cfg)
    vs = make_video_synthesis(cfg)

    _simulation.sampling_params = sp
    _clips.video_synthesis = vs

    import celegans

    celegans.video_synthesis = vs
    for mod in also_patch:
        if hasattr(mod, "video_synthesis"):
            mod.video_synthesis = vs
    return sp, vs
