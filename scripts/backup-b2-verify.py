#!/usr/bin/env python3
"""B2 API ile yerel dosyayı karşılaştır — rclone ls/HEAD (f005) kullanmaz."""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup"))
from b2_api import B2Error, authorize, find_file, list_files, verify_local_against_b2  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--bucket", default="meridyen-backups")
    p.add_argument("--prefix", required=True)
    p.add_argument("--local", required=True)
    p.add_argument("--name", default="")
    args = p.parse_args()
    if not os.path.isfile(args.local):
        print(json.dumps({"ok": False, "error": "local missing"}))
        return 2
    name = args.name or os.path.basename(args.local)
    try:
        authz = authorize()
        files = list_files(authz, args.bucket, args.prefix if args.prefix.endswith("/") else args.prefix + "/")
        remote = find_file(files, name)
        if not remote:
            print(json.dumps({"ok": False, "error": "remote missing", "lookedFor": name, "listed": len(files)}))
            return 3
        result = verify_local_against_b2(args.local, remote)
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result.get("ok") else 4
    except B2Error as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 5
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": type(exc).__name__}))
        return 6


if __name__ == "__main__":
    raise SystemExit(main())
