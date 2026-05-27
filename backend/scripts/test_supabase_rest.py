#!/usr/bin/env python3
"""
Test Supabase REST API connection (no direct PostgreSQL needed).
Run from the backend/ directory:
  python scripts/test_supabase_rest.py
"""

import sys
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Fallback: read from frontend .env.local if backend .env not set
if not SUPABASE_URL:
    frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env.local"
    if frontend_env.exists():
        for line in frontend_env.read_text().splitlines():
            if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                SUPABASE_URL = line.split("=", 1)[1].strip()
            if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                SUPABASE_KEY = line.split("=", 1)[1].strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[FAIL] SUPABASE_URL and SUPABASE_ANON_KEY not configured")
    sys.exit(1)

try:
    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    result = client.table("topics").select("name, category, difficulty").execute()

    print(f"\n[OK] Supabase REST API connected: {SUPABASE_URL}")
    print(f"[OK] Topics in database: {len(result.data)}")

    if result.data:
        for row in result.data:
            print(f"     - {row['name']} ({row['category']}, {row['difficulty']})")
    else:
        print("[WARN] No topics found — run the SQL migration in Supabase dashboard first")
        print("       File: supabase/migrations/001_initial_schema.sql")

    # Test users table exists
    users_result = client.table("users").select("id").limit(1).execute()
    print(f"[OK] users table accessible")

    print("\n[OK] Database is ready for development")
    sys.exit(0)

except ImportError:
    print("[FAIL] supabase not installed. Run: pip install supabase")
    sys.exit(1)
except Exception as e:
    msg = str(e)
    if "relation" in msg and "does not exist" in msg:
        print(f"[FAIL] Table not found: {msg}")
        print("       Run the SQL migration in Supabase SQL Editor:")
        print("       supabase/migrations/001_initial_schema.sql")
    else:
        print(f"[FAIL] {msg}")
    sys.exit(1)
