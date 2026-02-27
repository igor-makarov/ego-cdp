#!/usr/bin/env bash
set -euo pipefail

printf 'curl ego-cdp (domain blocked)\n'
curl -f -v --noproxy '' http://ego-cdp-testing.localhost:9223/json/version > /dev/null
