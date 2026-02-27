#!/usr/bin/env bash
set -euo pipefail

printf 'curl ego-cdp (domain blocked)\n'
curl -f -v --noproxy '' http://ego-cdp.localhost:9222/json/version > /dev/null
