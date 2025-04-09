from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    AWS_REGION: str = "eu-west-2"

    COGNITO_USER_POOL_ID: str = "eu-west-2_BIsIlkwmE"
    COGNITO_CLIENT_ID: str = "3qmlaqabrf6out8gehg8r1o1n3"

    DEBUG_MODE: bool = False
    LOG_LEVEL: str = "INFO"

    RAW_FILE_BUCKET_NAME: str
    MEDIA_BUCKET_NAME: str

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", ".env.dev"),
        env_prefix="API_SERVICE_",
        case_sensitive=True,
        extra="ignore",
        frozen=True,
    )


_settings = AppSettings()


def get_settings() -> AppSettings:
    return _settings
