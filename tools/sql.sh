#!/usr/bin/env bash
# Run read-only SQL against the Betty's project through the Supabase Management
# API. The anon key cannot see the RLS-locked tables; this can.
#   ./tools/sql.sh "select count(*) from delivery_purchases"
#   ./tools/sql.sh -f query.sql
set -euo pipefail
REF="nhtxpinnvuqpfwnatqre"
if [ "${1:-}" = "-f" ]; then QUERY="$(cat "$2")"; else QUERY="$1"; fi
python3 - "$REF" "$QUERY" <<'PY'
import json, os, ssl, sys, urllib.request
ref, query = sys.argv[1], sys.argv[2]
token = os.environ["SUPABASE_ACCESS_TOKEN"]
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": query}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, context=ssl.create_default_context()) as r:
    print(json.dumps(json.load(r), indent=2, default=str))
PY
