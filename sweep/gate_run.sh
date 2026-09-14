#!/bin/bash
# The gate: train the repo's default simulator settings at a reduced size and score
# the model on real clips at several points along the way.
#
# If the score is flat at zero at the last checkpoint then this training budget is
# below the threshold where the model learns anything, and a sweep on it would be
# comparing noise against noise. If it climbs, the sweep measures something.
#
# Training runs in segments with --load so each segment resumes the previous one,
# which buys a learning curve for the price of about 30 s of extra startup per point
# instead of retraining from scratch at every step count.
#
# Usage: gate_run.sh <name> <simconfig or "none"> <segment_steps> <n_segments>
set -u
ROOT=/home/bolgac/projects/simulation-gap
export PYTHONPATH=$ROOT/deeptangle
cd "$ROOT/sweep" || exit 1

NAME=$1; CFG=$2; SEG=$3; NSEG=$4
RUNS=$ROOT/runs/$NAME
mkdir -p "$RUNS"

# Reduced size. kpoints, npca, latent_dim and n_suggestions are kept at the published
# values so the model has the same shape as the released one and the scorer sees the
# same 49-point skeletons. Only the frame and the worm count are reduced.
COMMON="--size=128 --nworms=30 --batch_size=4 --nframes=11 --kpoints=49 --npca=12 \
--latent_dim=8 --nworms_pca=20000 --warmup=1 --eval_interval=50 --save"

CFGFLAG=""
[ "$CFG" != "none" ] && CFGFLAG="--simconfig=$CFG"

PREV=""
for i in $(seq 1 "$NSEG"); do
  STEPS=$((SEG * i))
  OUT=$RUNS/seg$i
  LOADFLAG=""
  [ -n "$PREV" ] && LOADFLAG="--load=$PREV"

  T0=$(date +%s)
  # shellcheck disable=SC2086
  timeout 3600 python3 sweep_run.py $CFGFLAG $COMMON --train_steps=$SEG \
      --checkpoint_dir="$OUT" $LOADFLAG > "$RUNS/train_seg$i.log" 2>&1
  RC=$?
  T1=$(date +%s)

  CKPT=$(find "$OUT" -name arrays.npy -printf '%h\n' 2>/dev/null | head -1)
  if [ $RC -ne 0 ] || [ -z "$CKPT" ]; then
    echo "$NAME seg$i steps=$STEPS TRAIN_FAILED rc=$RC"
    tail -5 "$RUNS/train_seg$i.log"
    exit 1
  fi
  echo "$NAME seg$i steps=$STEPS trained_in=$((T1 - T0))s ckpt=$CKPT"

  T2=$(date +%s)
  timeout 3600 python3 eval_real.py --model="$CKPT" \
      --data="$ROOT/data/labeled_data" \
      --labelling_check="$ROOT/data/labelling_check.json" \
      --limit=40 --out="$RUNS/score_seg$i.json" > "$RUNS/eval_seg$i.log" 2>&1
  ERC=$?
  T3=$(date +%s)
  if [ $ERC -ne 0 ]; then
    echo "$NAME seg$i steps=$STEPS EVAL_FAILED rc=$ERC after $((T3 - T2))s"
    tail -5 "$RUNS/eval_seg$i.log"
  else
    python3 - "$RUNS/score_seg$i.json" "$STEPS" "$((T1 - T0))" "$((T3 - T2))" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print("  steps=%s recall=%.4f region_recall=%.4f preds=%d median_adtw=%s "
      "train_s=%s eval_s=%s" % (
      sys.argv[2], d["recall"], d["region_recall"] or 0.0, d["predictions"],
      ("%.2f" % d["median_adtw_px"]) if d["median_adtw_px"] else "none",
      sys.argv[3], sys.argv[4]))
PY
  fi
  PREV=$CKPT
done
echo "$NAME GATEDONE"
