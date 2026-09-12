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
#
# /login is the one route this cannot photograph: demo mode signs you in, so the
# route redirects. Shoot it against a plain `npx next dev` instead.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${SHOT_OUT:-$REPO/.shots}"
PORT="${SHOT_PORT:-3007}"
PIDFILE="/tmp/bettys-shot-dev.pid"

mkdir -p "$OUT"

# Stop the server this script started. Matching on a process name instead would
# also match the shell running this script, which kills the run itself — so the
# pid is written down and only that pid is signalled.
stop_server() {
  if [ -f "$PIDFILE" ]; then
    local pid
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
}

if [ "${1:-}" = "--stop" ]; then
  stop_server
  echo "dev server stopped"
  exit 0
fi

# next build and next dev share .next/, so a build run against a live dev server
# leaves it serving half-written manifests. --restart is the way back.
if [ "${1:-}" = "--restart" ]; then
  stop_server
  shift
fi

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
# A 200 is not enough: a server whose .next was deleted under it answers with a
# 500 page that screenshots perfectly well. Check for real markup.
healthy() {
  curl -s --max-time 4 "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q '<body'
}

if healthy; then
  echo "using dev server already on :$PORT"
else
  stop_server
  echo "starting dev server on :$PORT (demo mode)…"
  (cd "$REPO" && NEXT_PUBLIC_DEMO=1 exec npx next dev -p "$PORT" > /tmp/bettys-shot-dev.log 2>&1 &
   echo $! > "$PIDFILE")
  for _ in $(seq 1 45); do
    healthy && break
    sleep 1
  done
  healthy || {
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
