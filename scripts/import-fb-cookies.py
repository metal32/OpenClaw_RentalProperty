#!/usr/bin/env python3
"""Import Facebook cookies from EditThisCookie JSON into Chrome's cookie database.

Usage: python3 import-fb-cookies.py <cookies.json>

Expects the browser to be STOPPED before running (SQLite lock).
"""
import json
import sqlite3
import sys
import time

CHROME_EPOCH_OFFSET = 11644473600  # seconds between 1601-01-01 and 1970-01-01
COOKIE_DB = "/home/azureuser/.openclaw/browser/openclaw/user-data/Default/Cookies"


def to_chrome_time(unix_ts):
    """Convert Unix timestamp to Chrome's microseconds-since-1601 format."""
    return int((unix_ts + CHROME_EPOCH_OFFSET) * 1_000_000)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import-fb-cookies.py <cookies.json>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        cookies = json.load(f)

    conn = sqlite3.connect(COOKIE_DB)
    cur = conn.cursor()

    # Remove old facebook cookies
    cur.execute("DELETE FROM cookies WHERE host_key = '.facebook.com'")
    print(f"Deleted {cur.rowcount} old .facebook.com cookies")

    chrome_now = to_chrome_time(int(time.time()))
    ok = 0
    fail = 0

    for c in cookies:
        domain = c.get("domain", "")
        if "facebook.com" not in domain:
            continue

        name = c["name"]
        value = c["value"]
        path = c.get("path", "/")
        secure = 1 if c.get("secure", False) else 0
        httponly = 1 if c.get("httpOnly", False) else 0
        expires = to_chrome_time(c["expirationDate"]) if "expirationDate" in c else 0
        has_expires = 1 if expires > 0 else 0

        try:
            cur.execute(
                """INSERT INTO cookies (
                    creation_utc, host_key, top_frame_site_key, name, value,
                    encrypted_value, path, expires_utc, is_secure, is_httponly,
                    last_access_utc, has_expires, is_persistent, priority,
                    samesite, source_scheme, source_port, last_update_utc,
                    source_type, has_cross_site_ancestor
                ) VALUES (?, ?, '', ?, ?, X'', ?, ?, ?, ?, ?, ?, ?, 1, 0, 2, 443, ?, 0, 0)""",
                (
                    chrome_now,
                    domain,
                    name,
                    value,
                    path,
                    expires,
                    secure,
                    httponly,
                    chrome_now,
                    has_expires,
                    has_expires,
                    chrome_now,
                ),
            )
            print(f"  OK: {name}")
            ok += 1
            chrome_now += 1  # ensure unique creation_utc
        except Exception as e:
            print(f"  FAIL: {name} — {e}")
            fail += 1

    conn.commit()

    # Verify
    cur.execute("SELECT COUNT(*) FROM cookies WHERE host_key = '.facebook.com'")
    count = cur.fetchone()[0]
    conn.close()

    print(f"\nResult: {ok} written, {fail} failed, {count} total in DB")
    sys.exit(1 if fail > 0 else 0)


if __name__ == "__main__":
    main()
