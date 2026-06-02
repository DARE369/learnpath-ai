"""Configuration validation at startup (Packet 6.2)"""

import os
import sys
import logging
from typing import List

logger = logging.getLogger(__name__)

# NOTE: names must match the env vars the app actually reads in config.py.
# The secret is JWT_SECRET (not JWT_SECRET_KEY) — a mismatch here makes
# validate_config() fail and sys.exit(1) at boot, silently rolling the
# deployment back to the last image that booted.
REQUIRED_ENV_VARS = [
    "DATABASE_URL",
    "ENVIRONMENT",
    "JWT_SECRET",
    "FRONTEND_URL",
]

OPTIONAL_ENV_VARS = {
    "GOOGLE_CLIENT_ID": "Google OAuth",
    "GOOGLE_CLIENT_SECRET": "Google OAuth",
    "YOUTUBE_API_KEY": "YouTube integration",
    "CLAUDE_API_KEY": "Claude API",
    "GEMINI_API_KEY": "Gemini API",
    "FLUTTERWAVE_SECRET_KEY": "Flutterwave payments",
    "FLUTTERWAVE_PUBLIC_KEY": "Flutterwave payments",
    "RESEND_API_KEY": "Email notifications",
    "SENTRY_DSN": "Error tracking",
    "REDIS_URL": "Redis caching",
    "LOG_LEVEL": "Logging",
}

def validate_config() -> bool:
    """Validate all required environment variables at startup.

    Returns:
        bool: True if all required vars present, False otherwise
    """
    missing = []

    # Check required vars
    for var in REQUIRED_ENV_VARS:
        if not os.getenv(var):
            missing.append(var)

    if missing:
        logger.error(f"FATAL: Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set all required variables and restart the application.")
        return False

    # Warn about optional vars
    missing_optional = []
    for var, description in OPTIONAL_ENV_VARS.items():
        if not os.getenv(var):
            missing_optional.append(f"{var} ({description})")

    if missing_optional:
        logger.warning(f"Optional features disabled: {', '.join(missing_optional)}")

    logger.info("✓ Configuration validation passed")
    return True


def validate_database() -> bool:
    """Validate database connectivity.

    Returns:
        bool: True if database is reachable
    """
    try:
        from database import check_connection
        if check_connection():
            logger.info("✓ Database connection verified")
            return True
        else:
            logger.error("FATAL: Database connection failed")
            return False
    except Exception as e:
        logger.error(f"FATAL: Database validation error: {e}")
        return False


def validate_api_keys() -> bool:
    """Advisory presence check for external API keys.

    Deliberately makes NO network calls — boot-time calls to Claude/YouTube
    were both fragile (SDK drift, optional deps) and a startup hazard. We only
    confirm the keys are configured and log warnings otherwise. Always returns
    True: a missing optional key must never block startup.
    """
    if os.getenv("CLAUDE_API_KEY"):
        logger.info("✓ Claude API key present")
    else:
        logger.warning("CLAUDE_API_KEY not set — Claude-powered features disabled")

    if os.getenv("YOUTUBE_API_KEY"):
        logger.info("✓ YouTube API key present")
    else:
        logger.warning("YOUTUBE_API_KEY not set — YouTube search disabled")

    return True


def startup_checks() -> bool:
    """Run all startup validation checks.

    Returns:
        bool: True if all critical checks pass
    """
    logger.info("=" * 60)
    logger.info("Running startup configuration checks...")
    logger.info("=" * 60)

    checks = [
        ("Configuration", validate_config),
        ("Database", validate_database),
        ("API Keys", validate_api_keys),
    ]

    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            logger.error(f"Check '{name}' failed with exception: {e}")
            results.append((name, False))

    logger.info("=" * 60)
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        logger.info(f"{name}: {status}")
    logger.info("=" * 60)

    # Fail startup if any critical check failed
    critical_checks = ["Configuration", "Database"]
    for name, result in results:
        if name in critical_checks and not result:
            logger.error(f"FATAL: Critical check '{name}' failed. Exiting.")
            sys.exit(1)

    return all(result for _, result in results)
