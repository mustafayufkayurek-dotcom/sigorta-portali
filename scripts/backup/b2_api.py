#!/usr/bin/env python3
"""Backblaze B2 Native API (api.backblazeb2.com) — f005 download endpoint kullanmaz."""
from __future__ import annotations

import base64
import configparser
import hashlib
import json
import os
import urllib.request
from typing import Any

RCLONE_CONF_CANDIDATES = (
    "/root/.config/rclone/rclone.conf",
    os.path.expanduser("~/.config/rclone/rclone.conf"),
    "/opt/app/.config/rclone/rclone.conf",
)


class B2Error(RuntimeError):
    pass


def _load_creds() -> tuple[str, str]:
    cfg = configparser.ConfigParser()
    path = next((p for p in RCLONE_CONF_CANDIDATES if os.path.isfile(p)), None)
    if not path:
        raise B2Error("rclone.conf bulunamadı")
    cfg.read(path)
    section = os.environ.get("RCLONE_B2_SECTION", "b2-offsite")
    if not cfg.has_section(section):
        for sec in cfg.sections():
            if cfg.get(sec, "type", fallback="") == "b2":
                section = sec
                break
        else:
            raise B2Error("rclone B2 bölümü yok")
    return cfg.get(section, "account"), cfg.get(section, "key")


def authorize() -> dict[str, Any]:
    account, key = _load_creds()
    token = base64.b64encode(f"{account}:{key}".encode()).decode()
    req = urllib.request.Request(
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
        headers={"Authorization": f"Basic {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _post(api: str, auth: str, method: str, body: dict[str, Any], timeout: int = 45) -> dict[str, Any]:
    req = urllib.request.Request(
        f"{api}/b2api/v2/{method}",
        data=json.dumps(body).encode(),
        headers={"Authorization": auth, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def bucket_id(authz: dict[str, Any], name: str) -> str:
    data = _post(
        authz["apiUrl"],
        authz["authorizationToken"],
        "b2_list_buckets",
        {"accountId": authz["accountId"], "bucketName": name},
    )
    buckets = data.get("buckets") or []
    if not buckets:
        raise B2Error(f"bucket yok: {name}")
    return buckets[0]["bucketId"]


def list_files(authz: dict[str, Any], bucket: str, prefix: str) -> list[dict[str, Any]]:
    bid = bucket_id(authz, bucket)
    out: list[dict[str, Any]] = []
    start = None
    while True:
        body: dict[str, Any] = {"bucketId": bid, "prefix": prefix, "maxFileCount": 1000}
        if start:
            body["startFileName"] = start
        data = _post(authz["apiUrl"], authz["authorizationToken"], "b2_list_file_names", body)
        out.extend(data.get("files") or [])
        start = data.get("nextFileName")
        if not start:
            break
        if len(out) > 20000:
            break
    return out


def find_file(files: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    for f in files:
        fn = f.get("fileName") or ""
        if fn == name or fn.endswith("/" + name) or os.path.basename(fn) == name:
            return f
    return None


def local_hashes(path: str) -> dict[str, str]:
    md5 = hashlib.md5()
    sha1 = hashlib.sha1()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            md5.update(chunk)
            sha1.update(chunk)
    return {"md5": md5.hexdigest(), "sha1": sha1.hexdigest(), "bytes": str(os.path.getsize(path))}


def verify_local_against_b2(local_path: str, remote: dict[str, Any]) -> dict[str, Any]:
    hashes = local_hashes(local_path)
    remote_len = int(remote.get("contentLength") or 0)
    local_len = int(hashes["bytes"])
    sha_ok = (remote.get("contentSha1") or "") == hashes["sha1"]
    md5_ok = (remote.get("contentMd5") or "") == hashes["md5"]
    size_ok = remote_len == local_len and local_len > 0
    return {
        "fileName": remote.get("fileName"),
        "localPath": local_path,
        "localBytes": local_len,
        "remoteBytes": remote_len,
        "sha1Match": sha_ok,
        "md5Match": md5_ok,
        "sizeMatch": size_ok,
        "ok": bool(size_ok and sha_ok),
        "contentSha1": remote.get("contentSha1"),
        "uploadTimestamp": remote.get("uploadTimestamp"),
        "action": remote.get("action"),
    }
