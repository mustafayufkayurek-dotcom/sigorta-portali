#!/usr/bin/env python3
"""Backup health JSON yaz. SUCCESS yalnızca tüm kritik aşamalar geçince."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

IST = timezone(timedelta(hours=3))
MIN_DB = 10240
MIN_UP = 100
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


def artifact_ok(a: dict, min_bytes: int) -> bool:
    return bool(
        a.get("localOk")
        and a.get("uploadOk")
        and a.get("remoteVerifyOk")
        and a.get("checksumOk")
        and int(a.get("bytes") or 0) >= min_bytes
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--duration-seconds", type=int, default=0)
    p.add_argument("--error", default="")
    p.add_argument("--db-json", required=True, help="db artifact JSON")
    p.add_argument("--uploads-json", required=True, help="uploads artifact JSON")
    p.add_argument("--scheduler-json", default="{}")
    p.add_argument("--notify-json", default="{}")
    p.add_argument("--encryption", default="none")
    args = p.parse_args()

    db = json.loads(args.db_json)
    up = json.loads(args.uploads_json)
    prev = load_latest()
    db_ok = artifact_ok(db, MIN_DB)
    up_ok = artifact_ok(up, MIN_UP)
    result = "SUCCESS" if db_ok and up_ok and not args.error else "FAILED"
    last_success = prev.get("lastSuccessAt")
    if result == "SUCCESS":
        last_success = now_iso()

    record = {
        "schemaVersion": 1,
        "recordedAt": now_iso(),
        "result": result,
        "durationSeconds": args.duration_seconds,
        "encryption": args.encryption,
        "db": db,
        "uploads": up,
        "b2": {
            "ok": bool(db.get("remoteVerifyOk") and up.get("remoteVerifyOk")),
        },
        "scheduler": json.loads(args.scheduler_json or "{}"),
        "notify": json.loads(args.notify_json or "{}"),
        "lastSuccessAt": last_success,
        "error": args.error or (None if result == "SUCCESS" else "kritik aşama başarısız"),
    }
    # Restore kanıtını yeni backup kaydı ezmesin
    if prev.get("restoreTest"):
        record["restoreTest"] = prev["restoreTest"]

    HEALTH_DIR.mkdir(parents=True, exist_ok=True)
    (HEALTH_DIR / "latest.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (HEALTH_DIR / "history.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(json.dumps({"result": result, "path": str(HEALTH_DIR / "latest.json")}, ensure_ascii=False))

    persist = os.environ.get("BACKUP_HEALTH_PERSIST_SQL", "1")
    if persist == "1":
        _persist_system_settings(record)
    return 0 if result == "SUCCESS" else 1


def _persist_system_settings(record: dict) -> None:
    """system_settings.backup_health — migration yok. Hata health kaydını bozmaz."""
    app = os.environ.get("APP_DIR", "/opt/app")
    env_file = os.path.join(app, ".env.production")
    user = os.environ.get("POSTGRES_USER", "meridyen")
    db = os.environ.get("POSTGRES_DB", "meridyen_db")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    container = os.environ.get("POSTGRES_CONTAINER", "sigorta-postgres")
    if os.path.isfile(env_file) and not password:
        # kaynak: host env dosyası; stdout'a yazılmaz
        with open(env_file, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                v = v.strip().strip('"').strip("'")
                if k == "POSTGRES_PASSWORD":
                    password = v
                elif k == "POSTGRES_USER":
                    user = v
                elif k == "POSTGRES_DB":
                    db = v
    payload = json.dumps(record, ensure_ascii=False).replace("'", "''")
    sql = (
        "INSERT INTO system_settings (id, key, value, updated_at) "
        f"VALUES (gen_random_uuid()::text, 'backup_health', '{payload}'::jsonb, now()) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();\n"
    )
    try:
        subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                "-e",
                f"PGPASSWORD={password}",
                container,
                "psql",
                "-U",
                user,
                "-d",
                db,
                "-v",
                "ON_ERROR_STOP=1",
            ],
            input=sql.encode(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=30,
        )
    except Exception:
        pass


if __name__ == "__main__":
    raise SystemExit(main())
