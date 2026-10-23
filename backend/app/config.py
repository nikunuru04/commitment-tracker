from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    DATA_DIR: Path = Path("./data")
    STATIC_DIR: Path | None = None
    APP_PASSWORD: str | None = None
    CORS_ORIGINS: str = "*"
    TZ: str = "Asia/Kuala_Lumpur"


settings = Settings()
