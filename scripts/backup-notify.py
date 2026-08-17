#!/usr/bin/env python3
"""Backup Telegram + e-posta. Aynı durum spamlenmez. Secret loglanmaz."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import smtplib
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from pathlib import Path

IST = timezone(timedelta(hours=3))
STATE_DIR = Path(os.environ.get("BACKUP_HEALTH_DIR", "/opt/app/logs/backup-health"))
NOTIFY = os.environ.get("NOTIFY_SCRIPT", "")
if not NOTIFY:
    for candidate in (
        "/opt/app/scripts/monitoring/telegram-notify.sh",
        "/opt/app/scripts/telegram-notify.sh",
    ):
        if os.path.isfile(candidate):
            NOTIFY = candidate
            break
APP_DIR = os.environ.get("APP_DIR", "/opt/app")


def _state_path() -> Path:
    return STATE_DIR / "notify-state.json"


def load_state() -> dict:
    p = _state_path()
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_state(st: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    _state_path().write_text(json.dumps(st, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def should_send(kind: str, result: str, fingerprint: str) -> bool:
    st = load_state()
    key = f"{kind}:{result}:{fingerprint}"
    last = st.get("last") or {}
    if last.get("key") == key:
        return False
    # SUCCESS: günde bir; FAILED: durum değişince veya 12s geçince
    if result == "SUCCESS" and last.get("result") == "SUCCESS":
        prev = last.get("day")
        today = datetime.now(IST).date().isoformat()
        if prev == today:
            return False
    return True


def mark_sent(kind: str, result: str, fingerprint: str, extra: dict) -> None:
    st = load_state()
    st["last"] = {
        "key": f"{kind}:{result}:{fingerprint}",
        "result": result,
        "day": datetime.now(IST).date().isoformat(),
        **extra,
    }
    save_state(st)


def restore_failed(health: dict) -> bool:
    rt = health.get("restoreTest") or {}
    return str(rt.get("status") or "").upper() == "FAIL"


def notify_result(health: dict) -> str:
    if restore_failed(health):
        return "FAILED"
    return health.get("result") or "FAILED"


def format_body(health: dict) -> str:
    ts = health.get("recordedAt") or datetime.now(IST).strftime("%d.%m.%Y %H:%M")
    result = health.get("result")
    db = health.get("db") or {}
    up = health.get("uploads") or {}
    last = health.get("lastSuccessAt") or "yok"
    rt = health.get("restoreTest") or {}
    if restore_failed(health):
        err = rt.get("error") or health.get("error") or "Restore testi başarısız"
        return (
            "MERİDYEN BACKUP KRİTİK HATA\n"
            "Restore testi başarısız.\n"
            f"Tarih/Saat:\n{rt.get('testedAt') or ts}\n"
            f"Dosya:\n{rt.get('backupFile') or '—'}\n"
            f"Hata:\n{err}\n"
            f"Son başarılı backup:\n{last}\n"
        )
    if result == "SUCCESS":
        return (
            "MERİDYEN BACKUP — BAŞARILI\n"
            f"Tarih/Saat:\n{ts}\n"
            f"DB:\nBaşarılı ({db.get('fileName','')}, {db.get('bytes',0)} byte)\n"
            f"Uploads:\nBaşarılı ({up.get('fileName','')}, {up.get('bytes',0)} byte)\n"
            "Backblaze B2:\nBaşarılı\n"
            "Remote verification:\nBaşarılı\n"
            "Checksum:\nBaşarılı\n"
            f"Toplam süre:\n{health.get('durationSeconds', 0)} sn\n"
            "Durum:\n🟢 BACKUP HEALTHY\n"
        )
    stage = health.get("error") or "Bilinmeyen aşama"
    return (
        "MERİDYEN BACKUP — KRİTİK HATA\n"
        f"Tarih/Saat:\n{ts}\n"
        "Durum:\n🔴 BACKUP FAILED\n"
        f"Aşama:\n{stage}\n"
        f"Hata:\n{stage}\n"
        f"Son başarılı backup:\n{last}\n"
        f"DB:\n{db.get('fileName','')} local={db.get('localOk')} b2={db.get('remoteVerifyOk')} bytes={db.get('bytes')}\n"
        f"Uploads:\n{up.get('fileName','')} local={up.get('localOk')} b2={up.get('remoteVerifyOk')} bytes={up.get('bytes')}\n"
    )


def send_telegram(health: dict) -> str:
    result = notify_result(health)
    severity = "RECOVERY" if result == "SUCCESS" else "CRITICAL"
    code = "BACKUP_OK" if result == "SUCCESS" else "BACKUP_FAILED"
    title = "Yedek sağlıklı" if result == "SUCCESS" else "Yedek kritik hata"
    if restore_failed(health):
        code = "BACKUP_RESTORE_FAILED"
        title = "Restore testi başarısız"
    body = format_body(health)
    if not os.path.isfile(NOTIFY):
        return "failed:notify-script-missing"
    try:
        r = subprocess.run(
            [NOTIFY, severity, code, title, body[:1500], "Yedekleme kapasitesi.", "Yedek sağlık kaydını kontrol edin."],
            check=False,
            timeout=45,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return "sent" if r.returncode == 0 else "failed"
    except Exception:
        return "failed"


def _mail_config() -> dict | None:
    env_file = os.path.join(APP_DIR, ".env.production")
    user = os.environ.get("POSTGRES_USER", "meridyen")
    db = os.environ.get("POSTGRES_DB", "meridyen_db")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    container = os.environ.get("POSTGRES_CONTAINER", "sigorta-postgres")
    if os.path.isfile(env_file) and not password:
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
    try:
        proc = subprocess.run(
            [
                "docker",
                "exec",
                "-e",
                f"PGPASSWORD={password}",
                container,
                "psql",
                "-U",
                user,
                "-d",
                db,
                "-tAc",
                "SELECT value::text FROM system_settings WHERE key = 'mail_config' LIMIT 1;",
            ],
            check=False,
            capture_output=True,
            timeout=30,
        )
        raw = (proc.stdout or b"").decode().strip()
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


def send_email(health: dict) -> str:
    cfg = _mail_config()
    if not cfg or not cfg.get("host"):
        return "failed:mail-config-missing"
    to_addr = os.environ.get("BACKUP_ALERT_EMAIL") or cfg.get("fromEmail") or ""
    if not to_addr:
        return "failed:no-recipient"
    result = notify_result(health)
    subject = "MERİDYEN BACKUP BAŞARILI" if result == "SUCCESS" else "MERİDYEN BACKUP KRİTİK HATA"
    body = format_body(health)
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = cfg.get("fromEmail") or to_addr
    msg["To"] = to_addr
    host = cfg.get("host")
    port = int(cfg.get("port") or 587)
    user = cfg.get("username") or ""
    password = cfg.get("password") or ""
    security = (cfg.get("security") or "TLS").upper()
    try:
        if security == "SSL" or port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=30, context=context) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.sendmail(msg["From"], [to_addr], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                if user:
                    smtp.login(user, password)
                smtp.sendmail(msg["From"], [to_addr], msg.as_string())
        return "sent"
    except Exception:
        return "failed"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--health-json", default=str(STATE_DIR / "latest.json"))
    p.add_argument("--force", action="store_true")
    args = p.parse_args()
    path = Path(args.health_json)
    if not path.is_file():
        print(json.dumps({"telegram": "skipped", "email": "skipped", "error": "no-health"}))
        return 2
    health = json.loads(path.read_text(encoding="utf-8"))
    result = notify_result(health)
    rt = health.get("restoreTest") or {}
    fp = hashlib.sha1(
        json.dumps(
            {
                "r": result,
                "e": health.get("error"),
                "db": (health.get("db") or {}).get("fileName"),
                "restore": rt.get("status"),
                "restoreAt": rt.get("testedAt"),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()[:16]
    out = {"telegram": "suppressed", "email": "suppressed"}
    if args.force or should_send("backup", result, fp):
        out["telegram"] = send_telegram(health)
        out["email"] = send_email(health)
        mark_sent("backup", result, fp, {"telegram": out["telegram"], "email": out["email"]})
        # e-posta hatasını health'e işle
        try:
            health.setdefault("notify", {})
            health["notify"].update(out)
            if out["email"].startswith("failed"):
                health["notify"]["emailError"] = out["email"]
            path.write_text(json.dumps(health, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
