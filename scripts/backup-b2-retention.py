#!/usr/bin/env python3
"""B2 retention: db/ ve uploads/ günlük 90 gün. monthly/ 12 ay.
daily/ önekine DOKUNMA. Doğrulanmamış veya tek kalan dosyayı silme/gizleme.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup"))
from b2_api import authorize, bucket_id, list_files, _post  # noqa: E402

BUCKET = os.environ.get("B2_BUCKET", "meridyen-backups")
DAILY_KEEP_DAYS = int(os.environ.get("B2_DAILY_KEEP_DAYS", "90"))
MONTHLY_KEEP_DAYS = int(os.environ.get("B2_MONTHLY_KEEP_DAYS", "365"))
MIN_DB = 10240
MIN_UP = 100
NOW_MS = int(time.time() * 1000)


def hide(authz, name: str) -> None:
    bid = bucket_id(authz, BUCKET)
    _post(authz["apiUrl"], authz["authorizationToken"], "b2_hide_file", {"bucketId": bid, "fileName": name})


def eligible(files, min_bytes: int, keep_days: int):
    cutoff = NOW_MS - keep_days * 24 * 3600 * 1000
    valid = [f for f in files if int(f.get("contentLength") or 0) >= min_bytes and f.get("action") == "upload"]
    old = [f for f in valid if int(f.get("uploadTimestamp") or 0) < cutoff]
    return valid, old


def prune_prefix(authz, prefix: str, min_bytes: int, keep_days: int) -> int:
    files = list_files(authz, BUCKET, prefix)
    valid, old = eligible(files, min_bytes, keep_days)
    hidden = 0
    for f in old:
        remaining = len(valid) - hidden
        if remaining <= 1:
            print(f"KEEP last valid under {prefix}: {f.get('fileName')}")
            break
        name = f.get("fileName")
        print(f"HIDE {name}")
        hide(authz, name)
        hidden += 1
    return hidden


def main() -> int:
    authz = authorize()
    n = 0
    n += prune_prefix(authz, "db/", MIN_DB, DAILY_KEEP_DAYS)
    n += prune_prefix(authz, "uploads/", MIN_UP, DAILY_KEEP_DAYS)
    n += prune_prefix(authz, "monthly/", MIN_DB, MONTHLY_KEEP_DAYS)
    print(f"hidden={n} skipped_prefix=daily/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
