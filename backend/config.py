from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings
from typing import Optional


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
    JWT_SECRET: str
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

    # Logging
    LOG_LEVEL: str = "INFO"

    # Self-Building Mechanism (Packet 3.5) — Nightly expansion job
    EXPANSION_SCHEDULER_ENABLED: bool = False
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
        if self.ENVIRONMENT not in ["development", "staging", "production"]:
            raise ValueError(f"Invalid ENVIRONMENT: {self.ENVIRONMENT}")

        if len(self.JWT_SECRET) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")

        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL is required")

        if self.ENVIRONMENT == "production":
            if not self.CLAUDE_API_KEY:
                raise ValueError("CLAUDE_API_KEY required in production")
            if not self.YOUTUBE_API_KEY:
                raise ValueError("YOUTUBE_API_KEY required in production")

        return True


settings = Settings()
settings.validate_settings()
