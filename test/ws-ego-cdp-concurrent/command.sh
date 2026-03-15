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
  node -e "
    const fs = require('node:fs');
    const parsed = JSON.parse(fs.readFileSync('result-$i.json', 'utf8'));
    if (!parsed.result?.product) { console.error('result-$i.json: no product'); process.exit(1); }
  "
  printf 'result-%d: ok\n' "$i"
done

printf 'concurrent ws calls test passed\n'
