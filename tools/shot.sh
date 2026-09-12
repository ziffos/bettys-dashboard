#!/usr/bin/env bash
#
# Screenshots the dashboard at desktop and phone width.
#
#   ./tools/shot.sh /sales               # one route, both widths
#   ./tools/shot.sh --all                # every dashboard route
#   ./tools/shot.sh --desktop /menu      # one width only
#   ./tools/shot.sh --phone /calendar
#
# Pictures land in .shots/ (gitignored). The design they are meant to match
# lives in design/reference/ — same filenames, so the two are easy to put side
# by side.
#
# The dev server is started in demo mode if it is not already up, because the
# real database stops in August 2026 and leaves most screens empty. A server
# that is already running on PORT is reused as-is.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${SHOT_OUT:-$REPO/.shots}"
PORT="${SHOT_PORT:-3007}"

mkdir -p "$OUT"

ROUTES=(
  "/:overview"
  "/sales:sales"
  "/marketing:marketing"
  "/products:products"
  "/reviews:reviews"
  "/menu:menu"
  "/platform-payouts:platform-payouts"
  "/calendar:calendar"
  "/payroll:payroll"
  "/tv-displays:tv-displays"
  "/my-payroll:my-payroll"
  "/settings:settings"
)

WIDTHS="both"
case "${1:-}" in
  --desktop) WIDTHS="desktop"; shift ;;
  --phone)   WIDTHS="phone";   shift ;;
esac

# Reuse a running server rather than starting a second one — two Next dev
# servers on the same repo fight over .next/ and produce half-built pages.
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"; then
  echo "using dev server already on :$PORT"
else
  echo "starting dev server on :$PORT (demo mode)…"
  (cd "$REPO" && NEXT_PUBLIC_DEMO=1 npx next dev -p "$PORT" > /tmp/bettys-shot-dev.log 2>&1 &)
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" && break
    sleep 1
  done
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" || {
    echo "dev server never came up — see /tmp/bettys-shot-dev.log" >&2
    exit 1
  }
fi

shoot() { # route name
  local route="$1" name="$2"
  if [ "$WIDTHS" != "phone" ]; then
    SHOT_BASE="http://127.0.0.1:$PORT" node "$REPO/tools/shot.mjs" \
      "$route" "$OUT/desktop-$name.png" 1440 1000
  fi
  if [ "$WIDTHS" != "desktop" ]; then
    SHOT_BASE="http://127.0.0.1:$PORT" node "$REPO/tools/shot.mjs" \
      "$route" "$OUT/phone-$name.png" 390 844
  fi
}

if [ "${1:-}" = "--all" ] || [ $# -eq 0 ]; then
  for entry in "${ROUTES[@]}"; do
    shoot "${entry%%:*}" "${entry##*:}"
  done
else
  for route in "$@"; do
    name="$(printf '%s' "$route" | sed 's#^/##; s#/#-#g')"
    shoot "$route" "${name:-overview}"
  done
fi

echo "→ $OUT"
