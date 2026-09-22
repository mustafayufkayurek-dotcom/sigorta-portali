#!/usr/bin/env bash
# Eski yüzde alarmı bekçiye bırakır: önce temizlik, haber ancak yetmezse.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/disk-watchdog.sh"
