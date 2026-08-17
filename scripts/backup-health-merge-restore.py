#!/usr/bin/env python3
"""restoreTest alanını latest.json'a ekler. result / lastSuccessAt / db / uploads ezilmez."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=3))
HEALTH_DIR = Path(os.environ.get("BACKUP_HEALTH_DIR", "/opt/app/logs/backup-health"))


def now_iso() -> str:
    return datetime.now(IST).isoformat(timespec="seconds")


def load_latest() -> dict:
    path = HEALTH_DIR / "latest.json"
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--status", required=True, choices=("PASS", "FAIL"))
    p.add_argument("--backup-file", default="")
    p.add_argument("--public-tables", type=int, default=0)
    p.add_argument("--claim-files", type=int, default=0)
    p.add_argument("--duration-seconds", type=int, default=0)
    p.add_argument("--error", default="")
    p.add_argument("--tested-at", default="")
    p.add_argument("--summary", default="")
    args = p.parse_args()

    record = load_latest()
    tested_at = args.tested_at or now_iso()
    summary = args.summary or (
        f"{args.public_tables} public tables, claim_files={args.claim_files}"
        if args.status == "PASS"
        else (args.error or "Restore testi başarısız")
    )
    restore = {
        "status": args.status,
        "testedAt": tested_at,
        "backupFile": args.backup_file,
        "summary": summary,
        "publicTables": args.public_tables,
        "claimFiles": args.claim_files,
        "durationSeconds": args.duration_seconds,
        "duration": args.duration_seconds,
        "error": args.error or None,
    }
    record["restoreTest"] = restore
    if args.status == "FAIL":
        record["error"] = args.error or "Restore testi başarısız"
    HEALTH_DIR.mkdir(parents=True, exist_ok=True)
    latest = HEALTH_DIR / "latest.json"
    latest.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (HEALTH_DIR / "history.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"restoreMergeAt": now_iso(), "restoreTest": restore}, ensure_ascii=False) + "\n")

    # persist: backup-health-record içindeki SQL yazıcı
    rec_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup-health-record.py")
    if os.path.isfile(rec_py) and os.environ.get("BACKUP_HEALTH_PERSIST_SQL", "1") == "1":
        import importlib.util

        spec = importlib.util.spec_from_file_location("backup_health_record", rec_py)
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "_persist_system_settings"):
                mod._persist_system_settings(record)

    print(json.dumps({"ok": True, "restoreTest": restore}, ensure_ascii=False))
    return 0 if args.status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
