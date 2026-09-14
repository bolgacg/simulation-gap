#!/usr/bin/env python3
"""Write docs/data.js from the sweep results."""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CANDIDATES = [ROOT / "data" / "results.json", ROOT / "results.json", ROOT / "sweep" / "results.json"]


def main(allow_fixture: bool = False) -> int:
    # Check the fields the page reads before writing anything. A page that renders a
    # missing field as "n/a" looks identical to one whose measurement came out empty,
    # and that class of bug has already survived several verification passes on the
    # sibling project in this campaign.
    try:
        import check_contract
        check_contract.main()
        print("---")
    except Exception as exc:
        print(f"  contract check could not run: {exc}")

    src = next((p for p in CANDIDATES if p.exists()), None)
    if src is None:
        raise SystemExit("no results.json found in " + ", ".join(str(p) for p in CANDIDATES))
    d = json.loads(src.read_text())

    # The evaluation set decides what the page may claim, so the check on it travels
    # with the results rather than being described in prose written by hand. If the
    # check has not been run, the page says the question is open instead of assuming.
    check = ROOT / "data" / "labelling_check.json"
    if check.exists():
        d["labelling_check"] = json.loads(check.read_text())

    # The per-clip counts behind the published-weights baseline, so the page can add
    # them up in the browser and show that its headline is the sum of its own parts
    # rather than a number that was typed. Only the counts travel: no clip content.
    base = ROOT / "data" / "baseline_real.json"
    if base.exists():
        b = json.loads(base.read_text())
        # Both scorings travel: over the whole frame, and restricted to the disc the hand
        # labels actually occupy. The page shows the correction rather than applying it
        # quietly, because a reader who knows this dataset should see what it did.
        d["baseline_per_clip"] = {
            "dtw_cutoff": b.get("dtw_cutoff"),
            "detection_settings": {"score_threshold": b.get("score_threshold"),
                                   "overlap_threshold": b.get("overlap_threshold")},
            "region": b.get("region"),
            "region_stated": {k[7:]: b.get(k) for k in
                              ("region_labels", "region_found", "region_predictions",
                               "region_recall", "region_precision") if b.get(k) is not None},
            "stated": {k: b.get(k) for k in ("labels", "found", "predictions", "recall", "precision", "median_adtw_px")},
            "sections": {
                k: {"labels": v["labels"], "found": v["found"],
                    "predictions": v["predictions"], "claimed": v["claimed"]}
                for k, v in (b.get("per_section") or {}).items()
            },
        }
        # Recall against worm density, which is the diagnostic that exposed the scoring
        # bug: a real detection limit degrades as the field crowds, and the buggy run was
        # flat at about 0.51 from the sparsest clips to the densest.
        import re as _re, collections as _c
        by = _c.defaultdict(lambda: [0, 0])
        for name, v in (b.get("per_section") or {}).items():
            m = _re.search(r"D3-(\d+(?:_\d+)?)x", name)
            if not m:
                continue
            dn = m.group(1).replace("_", ".")
            by[dn][0] += v["found"]; by[dn][1] += v["labels"]
        if by:
            d["baseline_per_clip"]["recall_by_density"] = [
                {"density": float(k), "found": v[0], "labels": v[1],
                 "recall": round(v[0] / v[1], 3)}
                for k, v in sorted(by.items(), key=lambda kv: float(kv[0])) if v[1]
            ]

    # The granulometry curves behind act three's warning. They travel because the warning
    # rests on the SHAPE of the curve rather than on any single number, and a shape stated
    # as eleven numbers inside a sentence is a shape nobody reads. The page draws it.
    ss = ROOT / "data" / "stats_sweep.json"
    if ss.exists():
        s = json.loads(ss.read_text())
        radii = [1, 2, 3, 4, 6]
        keys = ["open_r%d" % r for r in radii]
        real = (s.get("real") or {}).get("stats") or {}
        if all(k in real for k in keys):
            series = [{"name": "real footage", "is_real": True,
                       "values": [real[k] for k in keys]}]
            # Join on results.json for the axis, not on stats_sweep.json. A configuration
            # that holds the repository's own value on its axis is labelled "defaults"
            # there, so filtering stats_sweep by axis silently drops R_080, which is the
            # one line on this chart a reader most needs to see.
            by_name = {c["name"]: c for c in (s.get("configs") or [])}
            for c in d.get("configs") or []:
                if c.get("axis") != "body_radius":
                    continue
                st = (by_name.get(c["name"]) or {}).get("sim_stats") or {}
                if not all(k in st for k in keys):
                    print(f"  granulometry: no statistics for {c['name']}, leaving it off the chart")
                    continue
                series.append({"name": c["name"], "axis_value": c.get("axis_value"),
                               "is_repo_default": bool(c.get("is_repo_default_on_its_axis")),
                               "values": [st[k] for k in keys]})
            series[1:] = sorted(series[1:], key=lambda x: x.get("axis_value") or 0)
            d["granulometry"] = {
                "what": "share of bright pixels that survive a morphological opening of radius r, "
                        "which is a size curve for the bright structure in a frame",
                "radii": radii, "series": series,
                "axis": "body_radius",
                "repo_default": next((c.get("default_value") for c in (d.get("axes") or [])
                                      if c.get("key") == "body_radius"), None),
            }

    # Refuse to write fixture content into docs/ at all. The page has a runtime guard,
    # but a guard that fires in the browser does not stop `git add -A` from committing
    # the file, which is exactly what happened once. The only safe place to stop it is
    # before it is written. --allow-fixture exists for layout checks and says so loudly.
    blob = json.dumps(d)
    mark = re.search(r"fixture|placeholder|lorem ipsum|TODO", blob, re.I)
    if mark and not allow_fixture:
        print(f"REFUSING to write docs/data.js: the word {mark.group(0)!r} appears in the study "
              f"output, so this is not a result. Pass --allow-fixture to write it anyway for a "
              f"layout check, and delete docs/data.js afterwards.")
        return 2
    if mark:
        print(f"writing FIXTURE data because --allow-fixture was passed ({mark.group(0)!r} found). "
              f"Delete docs/data.js when the check is done.")

    DOCS.mkdir(parents=True, exist_ok=True)
    out = "/* generated by study/build_page_data.py, do not edit */\nconst D = " + \
        json.dumps(d, separators=(",", ":")) + ";\n"
    (DOCS / "data.js").write_text(out)
    cfg = d.get("configs") or []
    done = [c for c in cfg if c.get("real_score") is not None]
    print(f"wrote docs/data.js from {src.name}: {len(done)} of {len(cfg)} configurations scored")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--allow-fixture" in sys.argv))
