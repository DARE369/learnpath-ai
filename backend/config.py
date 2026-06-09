import logging
from pydantic import field_validator, model_validator, Field, AliasChoices
from pydantic_settings import BaseSettings
from typing import Optional

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "LearnPath AI"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    SQLALCHEMY_ECHO: bool = False

    # Security
    # Canonical env var is JWT_SECRET. JWT_SECRET_KEY is accepted as an alias to
    # avoid the historical boot trap where Railway had the value under the other
    # name. Optional here so we can fail with a clear message in validate_settings
    # rather than a generic pydantic "field required".
    JWT_SECRET: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("JWT_SECRET", "JWT_SECRET_KEY"),
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    REFRESH_TOKEN_EXPIRATION_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # API Keys
    CLAUDE_API_KEY: Optional[str] = None
    YOUTUBE_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # RBAC: comma-separated emails auto-promoted to admin on login/startup.
    ADMIN_EMAILS: Optional[str] = None

    # Logging
    LOG_LEVEL: str = "INFO"

    # Observability (Stage 2) — error monitoring. No-op when unset.
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

    # Transactional email (Stage 10) — first provider with a key wins. No-op when unset.
    RESEND_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "LearnPath AI <noreply@learnpath.ai>"

    # AI cost guardrails (Stage 6). Per-user daily spend cap in NGN (0 = no cap).
    AI_USER_DAILY_BUDGET_NGN: float = 50.0

    # Self-Building Mechanism (Packet 3.5) — Nightly expansion job
    EXPANSION_SCHEDULER_ENABLED: bool = False

    # Daily auto-adaptation of adaptive paths (NEW-PACKET-H).
    PATH_ADAPTATION_ENABLED: bool = True
    EXPANSION_SCHEDULER_HOUR_UTC: int = 2  # 2 AM UTC = midnight WAT

    # Payments (Packet 4.1) — Flutterwave gateway
    # All optional: when the secret key is unset the PaymentService degrades
    # gracefully (raises PaymentError instead of making live API calls), so
    # dev/CI never hit the network.
    FLUTTERWAVE_PUBLIC_KEY: Optional[str] = None
    FLUTTERWAVE_SECRET_KEY: Optional[str] = None
    FLUTTERWAVE_WEBHOOK_SECRET: Optional[str] = None
    FLUTTERWAVE_BASE_URL: str = "https://api.flutterwave.com/v3"
    PAYMENT_SUCCESS_URL: str = "http://localhost:3000/billing?status=success"
    PAYMENT_CANCEL_URL: str = "http://localhost:3000/billing?status=cancelled"
    PAYMENT_CURRENCY: str = "NGN"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    @model_validator(mode="after")
    def include_frontend_in_origins(self):
        if self.FRONTEND_URL and self.FRONTEND_URL not in self.ALLOWED_ORIGINS:
            self.ALLOWED_ORIGINS = list(self.ALLOWED_ORIGINS) + [self.FRONTEND_URL]
        return self

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off", ""}:
                return False
            return False
        return value

    def validate_settings(self):
        """Fail fast on misconfiguration, aggregating ALL problems into one clear
        error instead of failing on the first. Production has stricter required
        keys; non-fatal concerns are logged as warnings."""
        errors: list[str] = []
        warnings: list[str] = []

        if self.ENVIRONMENT not in ["development", "staging", "production"]:
            errors.append(
                f"ENVIRONMENT must be development|staging|production (got {self.ENVIRONMENT!r})"
            )

        if not self.JWT_SECRET:
            errors.append(
                "JWT_SECRET is required (set JWT_SECRET or its alias JWT_SECRET_KEY)"
            )
        elif len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters")

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required")

        is_prod = self.ENVIRONMENT == "production"
        if is_prod:
            if not self.CLAUDE_API_KEY:
                errors.append("CLAUDE_API_KEY is required in production")
            if not self.YOUTUBE_API_KEY:
                errors.append("YOUTUBE_API_KEY is required in production")
            # Non-fatal but worth shouting about in prod.
            if self.DEBUG:
                warnings.append("DEBUG is true in production — disable it")
            if "localhost" in (self.FRONTEND_URL or ""):
                warnings.append(f"FRONTEND_URL points at localhost in production ({self.FRONTEND_URL})")
            if not self.FLUTTERWAVE_SECRET_KEY:
                warnings.append("FLUTTERWAVE_SECRET_KEY unset — payments will run in safe/no-op mode")
            if not self.SENTRY_DSN:
                warnings.append("SENTRY_DSN unset — backend errors won't be reported")

        for w in warnings:
            logger.warning("[config] %s", w)

        if errors:
            raise ValueError(
                "Invalid configuration:\n  - " + "\n  - ".join(errors)
            )
        return True


settings = Settings()
settings.validate_settings()
