from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "DentFlow"
    DEBUG: bool = False
    # Comma-separated string — avoids pydantic-settings JSON-parsing list fields from .env
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/dentflow"
    DATABASE_SSL: bool = True   # set False only for local dev without SSL
    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "dev-secret-key-change-in-production-min-32-chars!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Local file uploads (used when S3 is not configured)
    UPLOAD_DIR: str = "uploads"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "dentflow-documents"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
