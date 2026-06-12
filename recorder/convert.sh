#!/usr/bin/env bash
# webm -> trimmed, muted, projector-friendly mp4 into ../assets/clips/
set -u
cd "$(dirname "$0")"
OUT=out
DST=../assets/clips
mkdir -p "$DST"

# name  start(s)  length(s)   — start skips the page-load/blank head
SINGLE=(
  "create-event 3.0 6"
  "venue-builder 4.2 7"
  "sessions 3.6 5"
  "publish-sync 3.4 5"
  "payment-setup 3.6 5"
  "dashboard 4.2 6"
  "guest-portal 4.6 6"
  "ticket 3.6 5"
  "qr-scan 3.6 5"
)

enc(){ # infile outfile start len [extra-vf]
  ffmpeg -y -ss "$3" -t "$4" -i "$1" -an \
    -vf "${5:-}scale=1280:-2:flags=lanczos,fps=24,format=yuv420p" \
    -c:v libopenh264 -b:v 1600k -movflags +faststart "$2" 2>/dev/null
}

for row in "${SINGLE[@]}"; do
  set -- $row; name=$1; ss=$2; len=$3
  src="$OUT/$name.webm"
  if [ -f "$src" ]; then enc "$src" "$DST/$name.mp4" "$ss" "$len" ""; echo "✓ $name.mp4"; else echo "– missing $src"; fi
done

# realtime-locking + payment: the meaningful state is at the END (after the click-scan),
# so trim from the end to get a clean loop of the selected seat / checkout summary.
tail_enc(){ # infile outfile seconds-from-end length
  ffmpeg -y -sseof "-$3" -i "$1" -t "$4" -an \
    -vf "scale=1280:-2:flags=lanczos,fps=24,format=yuv420p" \
    -c:v libopenh264 -b:v 1600k -movflags +faststart "$2" 2>/dev/null
}
[ -f "$OUT/realtime-locking.webm" ] && { tail_enc "$OUT/realtime-locking.webm" "$DST/realtime-locking.mp4" 6 5.5; echo "✓ realtime-locking.mp4 (tail)"; }
[ -f "$OUT/payment.webm" ]          && { tail_enc "$OUT/payment.webm"          "$DST/payment.mp4"          8 7;   echo "✓ payment.mp4 (tail)"; }

echo "=== result ==="; ls -la "$DST"
