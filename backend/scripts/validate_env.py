#!/usr/bin/env python3
"""
Validate environment configuration.
Run from the backend/ directory:
  python scripts/validate_env.py
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))
load_dotenv(backend_dir / ".env")


def check(name: str, required: bool = False) -> bool:
    exists = os.getenv(name) is not None
    mark = "[OK]" if exists else "[--]"
    print(f"{mark} {name}: {'(REQUIRED)' if required else '(optional)'}")
    return exists


def main():
    print("\n=== Environment Configuration Validation ===\n")

    print("REQUIRED variables:")
    ok = True
    ok &= check("DATABASE_URL", required=True)
    ok &= check("JWT_SECRET", required=True)

    print("\nAPI Keys (required in production, optional in development):")
    check("CLAUDE_API_KEY")
    check("YOUTUBE_API_KEY")
    check("GOOGLE_API_KEY")

    print("\nApp Settings (optional):")
    check("ENVIRONMENT")
    check("DEBUG")
    check("FRONTEND_URL")

    print("\n" + "=" * 45)

    if not ok:
        print("\n[FAILED] Required environment variables missing!")
        print("   Edit backend/.env with your values")
        sys.exit(1)

    from config import settings
    print("\n[OK] SUCCESS: All required variables configured!")
    print(f"   Environment: {settings.ENVIRONMENT}")
    print(f"   Database:    {settings.DATABASE_URL[:40]}...")
    sys.exit(0)


if __name__ == "__main__":
    main()
