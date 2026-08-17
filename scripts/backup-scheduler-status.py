#!/usr/bin/env python3
"""Scheduler sağlık özeti — script not found sınıfını yakala."""
from __future__ import annotations

import json
import os
import stat
import subprocess
from datetime import datetime, timezone, timedelta

APP = os.environ.get("APP_DIR", "/opt/app")
IST = timezone(timedelta(hours=3))
SCRIPTS = (
    "backup.sh",
    "backup-uploads.sh",
    "offsite-backup.sh",
    "backup-watchdog.sh",
    "verify-backup-health.sh",
)


def executable(path: str) -> bool:
    try:
        mode = os.stat(path).st_mode
        return bool(mode & stat.S_IXUSR)
    except OSError:
        return False


def crontab_text() -> str:
    try:
        r = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=10)
        return r.stdout or ""
    except Exception:
        return ""


def main() -> None:
    cron = crontab_text()
    items = []
    all_ok = True
    for name in SCRIPTS:
        path = os.path.join(APP, "scripts", name)
        exists = os.path.isfile(path)
        exe = executable(path) if exists else False
        in_cron = name in cron
        if name == "backup-watchdog.sh":
            required_cron = True
        else:
            required_cron = name in ("backup.sh", "backup-uploads.sh", "offsite-backup.sh")
        ok = exists and exe and (in_cron or not required_cron)
        if required_cron:
            ok = exists and exe and in_cron
        if not ok:
            all_ok = False
        items.append({"name": name, "exists": exists, "executable": exe, "inCron": in_cron, "ok": ok})
    print(json.dumps({
        "ok": all_ok,
        "checkedAt": datetime.now(IST).isoformat(timespec="seconds"),
        "scripts": items,
        "cronHasOffsite": "offsite-backup.sh" in cron,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
