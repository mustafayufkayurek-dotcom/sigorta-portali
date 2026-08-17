#!/bin/bash
set -euo pipefail

LOG_FILE="/opt/app/logs/docker-cache-prune.log"
mkdir -p "$(dirname "$LOG_FILE")"

TS="$(date '+%Y-%m-%d %H:%M:%S')"
{
  echo "===== $TS docker builder cache prune start ====="
  echo "-- df before --"
  df -h /
  echo "-- docker system df before --"
  docker system df
  echo "-- prune --"
  docker builder prune -af --filter "until=168h"
  echo "-- docker system df after --"
  docker system df
  echo "-- df after --"
  df -h /
  echo "===== $TS docker builder cache prune end ====="
} >> "$LOG_FILE" 2>&1
