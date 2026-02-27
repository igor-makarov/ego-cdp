#!/usr/bin/env bash
set -euo pipefail

printf 'checking google.com access\n'
curl -sSf https://www.google.com > /dev/null
printf 'google.com access confirmed\n'
