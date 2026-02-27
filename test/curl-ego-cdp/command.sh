#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp json/version endpoint\n'
curl -f -v --noproxy '' http://ego-cdp-testing.localhost:9223/json/version >/dev/null
printf 'ego-cdp endpoint reachable\n'
