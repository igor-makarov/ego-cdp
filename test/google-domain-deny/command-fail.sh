#!/usr/bin/env bash
set -euo pipefail

printf 'checking google.com is blocked\n'
curl -sSf https://www.google.com > /dev/null
printf 'google.com access unexpectedly succeeded\n'
