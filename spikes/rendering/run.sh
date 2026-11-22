#!/bin/bash

set -euo pipefail

usage="usage: run.sh canvas|items|empty full|reduced [seconds]  (env: SPIKE_DISPLAY=edp|hdmi, SPIKE_NO_VSYNC=1)"
renderer=${1:?$usage}
effects=${2:?$usage}
seconds=${3:-10}
display=${SPIKE_DISPLAY:-edp}
spike_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
log=$(mktemp /tmp/glyphrun-spike.XXXXXX.log)
gpu=$(grep -l 0x1002 /sys/class/drm/card*/device/vendor | head -1 | xargs dirname)

case $display in
  edp) monitor=eDP-2; width=960 ;;
  hdmi) monitor=HDMI-A-1; width=1920 ;;
  *) echo "$usage" >&2; exit 2 ;;
esac

if [ "${SPIKE_NO_VSYNC:-0}" = 1 ]; then export QSG_NO_VSYNC=1; fi

SPIKE_RENDERER=$renderer SPIKE_EFFECTS=$effects SPIKE_SECONDS=$seconds SPIKE_WIDTH=$width \
  QT_LOGGING_RULES="qt.scenegraph.time.renderloop.debug=true" \
  quickshell -p "$spike_dir" > "$log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true; rm -f -- "$log"' EXIT

dispatch() { hyprctl dispatch "$1" > /dev/null; }
until hyprctl clients -j | grep -q "\"pid\": $pid"; do sleep 0.2; done
window="pid:$pid"
dispatch "hl.dsp.window.move({ monitor = \"$monitor\", window = \"$window\" })"
if [ "$display" = edp ]; then
  dispatch "hl.dsp.window.float({ action = \"on\", window = \"$window\" })"
  dispatch "hl.dsp.window.resize({ x = 960, y = 540, window = \"$window\" })"
  dispatch "hl.dsp.window.center({ window = \"$window\" })"
else
  dispatch "hl.dsp.window.fullscreen({ mode = \"fullscreen\", window = \"$window\" })"
fi

busy=()
clock=()
for _ in $(seq $(((seconds + 30) * 10))); do
  grep -q "SPIKE_RESULT" "$log" && break
  kill -0 $pid 2>/dev/null || break
  if grep -q "SPIKE_MEASURE_START" "$log"; then
    if [ -n "${SPIKE_SCREENSHOT:-}" ] && [ ${#busy[@]} -eq 20 ]; then
      geometry=$(hyprctl clients -j | python3 -c "import json,sys; c=[c for c in json.load(sys.stdin) if c['pid']==$pid][0]; print('%d,%d %dx%d' % (*c['at'], *c['size']))")
      grim -g "$geometry" "$SPIKE_SCREENSHOT"
    fi
    busy+=("$(cat "$gpu/gpu_busy_percent")")
    clock+=("$(grep '\*' "$gpu/pp_dpm_sclk" | grep -oE '[0-9]+Mhz' | tr -d Mhz)")
  fi
  sleep 0.1
done

grep -o "SPIKE_RESULT.*" "$log" || { grep -v qt.scenegraph "$log" | tail -20; exit 1; }
printf '%s\n' "${busy[@]}" | awk '{ n++; s += $1 } END { if (n) printf "GPU_BUSY samples=%d mean=%.1f%%\n", n, s / n }'
printf '%s\n' "${clock[@]}" | awk '{ n++; s += $1 } END { if (n) printf "GPU_CLOCK mean=%.0fMHz\n", s / n }'
sed -n '/SPIKE_MEASURE_START/,$p' "$log" \
  | grep -oE "frame rendered in [0-9]+ms, sync=[0-9]+, render=[0-9]+, swap=[0-9]+" | tr -c '0-9\n' ' ' \
  | awk '{ n++; t += $1; sy += $2; r += $3; sw += $4 } END { if (n) printf "RENDER_THREAD frames=%d total=%.2fms sync=%.2fms render=%.2fms swap=%.2fms\n", n, t / n, sy / n, r / n, sw / n }'
