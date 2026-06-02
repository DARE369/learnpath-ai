"""Configuration validation at startup (Packet 6.2)"""

import os
import sys
import logging
from typing import List

logger = logging.getLogger(__name__)

REQUIRED_ENV_VARS = [
    "DATABASE_URL",
    "ENVIRONMENT",
    "JWT_SECRET_KEY",
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
    """Validate external API keys at startup.

    Returns:
        bool: True if critical APIs are reachable
    """
    issues = []

    # Test Claude API
    if os.getenv("CLAUDE_API_KEY"):
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
            client.messages.count_tokens(messages=[{"role": "user", "content": "test"}])
            logger.info("✓ Claude API verified")
        except Exception as e:
            issues.append(f"Claude API: {e}")

    # Test YouTube API
    if os.getenv("YOUTUBE_API_KEY"):
        try:
            from googleapiclient.discovery import build
            youtube = build("youtube", "v3", developerKey=os.getenv("YOUTUBE_API_KEY"))
            youtube.videos().list(part="snippet", id="test").execute()
        except Exception as e:
            # Expected to fail with test ID, just checking if API is reachable
            if "invalid" not in str(e).lower():
                issues.append(f"YouTube API: {e}")
            else:
                logger.info("✓ YouTube API verified")

    if issues:
        logger.warning(f"API validation warnings: {', '.join(issues)}")

    return len(issues) == 0


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
