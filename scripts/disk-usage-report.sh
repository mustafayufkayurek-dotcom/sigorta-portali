#!/bin/bash
set -euo pipefail

LOG_FILE="/opt/app/logs/disk-usage-report.log"
mkdir -p "$(dirname "$LOG_FILE")"

TS="$(date '+%Y-%m-%d %H:%M:%S')"
{
  echo "===== $TS disk usage report ====="
  echo "-- df -h --"
  df -h
  echo "-- key directories --"
  du -sh /var/lib/docker /var/lib/containerd /var/log /tmp /root /opt/backups 2>/dev/null || true
  echo "-- scoped top directories --"
  du -sh /var/lib/containerd/* /tmp/* /root/* 2>/dev/null | sort -hr | head -20 || true
  echo "-- docker system df --"
  docker system df
  echo
} >> "$LOG_FILE" 2>&1
