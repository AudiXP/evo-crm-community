#!/usr/bin/env bash
# Verifies that the CRM canonical event-names list and the evo-flow TS mirror
# stay in lockstep. Pure Bash + grep — no Ruby/Node/jq runtime required.
#
#   Ruby source: evo-ai-crm-community/lib/events/evo_flow_event_names.rb
#                (EvoFlow::EVENT_NAMES, %w[...] block)
#   TS source:   evo-flow/src/modules/events/event-names.enum.ts
#                (export const EVENT_NAMES = [ 'foo', 'bar', ... ] as const;)
#
# Exit 0 on match. Exit 1 on any of:
#   - the two lists disagree (DIVERGENT)
#   - the lists agree but the combined size != EXPECTED_COUNT (DIVERGENT count)
# Exit 2 on missing source files.
#
# When the canonical list legitimately grows, bump EXPECTED_COUNT here in the
# same PR that adds the entries — this is the gate that catches a 17-entry
# Ruby list + 17-entry TS list that nobody told the integration story about.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXPECTED_COUNT=16

RUBY_FILE="$REPO_ROOT/evo-ai-crm-community/lib/events/evo_flow_event_names.rb"
TS_FILE="$REPO_ROOT/evo-flow/src/modules/events/event-names.enum.ts"

for f in "$RUBY_FILE" "$TS_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "event_names_sync: ERROR — file not found: $f" >&2
    exit 2
  fi
done

# Ruby side: scope to the %w[ ... ] block, then tokenise on whitespace.
ruby_list=$(
  awk '
    /%w\[/ { capture = 1; sub(/.*%w\[/, "") }
    capture {
      line = $0
      if (sub(/\].*/, "", line)) { print line; capture = 0; exit }
      print line
    }
  ' "$RUBY_FILE" | tr -s '[:space:]' '\n' | sed '/^$/d' | sort -u
)

# TS side: scope to the EVENT_NAMES = [ ... ] block, THEN extract single-quoted
# literals. Anchoring to the block prevents a stray single-quoted string in a
# comment, JSDoc, or future export from leaking into the canonical set.
ts_list=$(
  awk '
    /EVENT_NAMES[[:space:]]*=[[:space:]]*\[/ { capture = 1 }
    capture {
      line = $0
      if (match(line, /\]/)) { print substr(line, 1, RSTART - 1); capture = 0; exit }
      print line
    }
  ' "$TS_FILE" | grep -oE "'[a-z][a-z._]*'" | tr -d "'" | sort -u
)

ruby_tmp=$(mktemp)
ts_tmp=$(mktemp)
diff_tmp=$(mktemp)
trap 'rm -f "$ruby_tmp" "$ts_tmp" "$diff_tmp"' EXIT
printf '%s\n' "$ruby_list" > "$ruby_tmp"
printf '%s\n' "$ts_list" > "$ts_tmp"

if ! diff -u "$ruby_tmp" "$ts_tmp" > "$diff_tmp"; then
  echo "event_names_sync: DIVERGENT — see diff below"
  echo "  (--- Ruby: $RUBY_FILE)"
  echo "  (+++ TS:   $TS_FILE)"
  cat "$diff_tmp"
  exit 1
fi

count=$(wc -l < "$ruby_tmp" | tr -d '[:space:]')
if [[ "$count" != "$EXPECTED_COUNT" ]]; then
  echo "event_names_sync: DIVERGENT — lists match each other but count is $count (expected $EXPECTED_COUNT)."
  echo "If this growth is intentional, bump EXPECTED_COUNT in $SCRIPT_DIR/check-event-names-sync.sh in the same PR."
  exit 1
fi

echo "event_names_sync: OK ($EXPECTED_COUNT entries)"
exit 0
