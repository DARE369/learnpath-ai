#!/usr/bin/env python3
"""
Test Supabase REST API using plain HTTP (no third-party libs, works on any Python).
Run from the backend/ directory:
  python scripts/test_supabase_http.py
"""

import urllib.request
import json
import sys
from pathlib import Path

# Read anon key from frontend .env.local
frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env.local"
supabase_url = ""
supabase_key = ""

for line in frontend_env.read_text().splitlines():
    if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
        supabase_url = line.split("=", 1)[1].strip()
    if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
        supabase_key = line.split("=", 1)[1].strip()

if not supabase_url or not supabase_key:
    print("[FAIL] Could not read Supabase credentials from frontend/.env.local")
    sys.exit(1)

print(f"Testing: {supabase_url}")

# Test 1: topics table
url = f"{supabase_url}/rest/v1/topics?select=name,category,difficulty"
req = urllib.request.Request(
    url,
    headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
        print(f"[OK] Supabase REST API connected")
        print(f"[OK] Topics table has {len(data)} rows")
        for row in data:
            name = row.get("name", "?")
            cat = row.get("category", "?")
            diff = row.get("difficulty", "?")
            print(f"     - {name} ({cat}, {diff})")
        if not data:
            print("[WARN] No topics — run 001_initial_schema.sql in Supabase SQL Editor first")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "relation" in body and "does not exist" in body:
        print("[FAIL] Tables not created yet")
        print("       Go to Supabase Dashboard -> SQL Editor and run:")
        print("       supabase/migrations/001_initial_schema.sql")
    else:
        print(f"[FAIL] HTTP {e.code}: {body[:200]}")
    sys.exit(1)
except Exception as e:
    print(f"[FAIL] {e}")
    sys.exit(1)

# Test 2: users table
url2 = f"{supabase_url}/rest/v1/users?select=id&limit=1"
req2 = urllib.request.Request(
    url2,
    headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
)
try:
    with urllib.request.urlopen(req2, timeout=10) as resp:
        print("[OK] users table accessible")
except Exception as e:
    print(f"[WARN] users table: {e}")

print("\n[OK] Database connection verified via REST API")
print("[OK] Ready for Packet 0.4")
