#!/usr/bin/env bash
set -euo pipefail

printf 'testing concurrent ws calls are serialized correctly\n'

# Fire 5 concurrent Browser.getVersion calls (all with id:1) in background
for i in 1 2 3 4 5; do
  "$ROOT_DIR/bin/ego-cdp" ws '{"id":1,"method":"Browser.getVersion"}' --output="result-$i.json" &
done

# Wait for all background jobs
wait

# Verify each result has a valid product field
for i in 1 2 3 4 5; do
  jq -e '.result.product | startswith("Chrome/")' "result-$i.json" >/dev/null || {
    printf 'result-%d.json: no Chrome product\n' "$i" >&2
    exit 1
  }
  printf 'result-%d: ok\n' "$i"
done

printf 'concurrent ws calls test passed\n'
