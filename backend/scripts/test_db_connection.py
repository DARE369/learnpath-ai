#!/usr/bin/env python3
"""
Database connection test - redirects to the REST API test.

Note: Direct psycopg2 connection does not work on this setup because
the Supabase host only has an IPv6 address and Python 3.14 on Windows
cannot resolve it. Use the REST API test instead.

Run:
  python scripts/test_supabase_http.py
"""

import subprocess
import sys
from pathlib import Path

print("Note: Direct psycopg2 connection unavailable (IPv6-only host, Python 3.14 limitation).")
print("Running REST API test instead...\n")

script = Path(__file__).parent / "test_supabase_http.py"
result = subprocess.run([sys.executable, str(script)])
sys.exit(result.returncode)
