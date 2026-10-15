import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):

    DATABASE_URL: str = "sqlite:///./operon.db"
    SECRET_KEY: str = "operon-enterprise-secret-key-2026-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    HF_TOKEN: str = "hf_dummy_token"
    META_KEY: str = "meta_dummy_key"
    QWEN_KEY: str = "qwen_dummy_key"
    GOOGLE_AI_KEY: str = "google_dummy_key"
    GROQ_KEY: str = "groq_dummy_key"
    REDIS_URL: str = "redis://localhost:6379/0"
    CHROMADB_API_KEY: str = "chroma_dummy_key"
    CHROMADB_TENANT: str = "default_tenant"
    CHROMADB_DATABASE: str = "default_database"
    AGENTMAIL_API_KEY: str = "agentmail_dummy_key"
    AGENT_DISPLAY_NAME: str = "Operon Support Agent"
    JIRA_API_KEY: str = "jira_dummy_key"
    JIRA_EMAIL: str = "ops@operon.io"
    JIRA_BASE_URL: str = "https://operon.atlassian.net"
    JIRA_PROJECT_KEY: str = "OPS"
    LANGFUSE_SECRET_KEY: str = "langfuse_secret_dummy"
    LANGFUSE_PUBLIC_KEY: str = "langfuse_public_dummy"
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    ARQ_AUTOSTART_WORKER: bool = False
    ARQ_WORKER_COMMAND: str = "python -m arq api.background_tasks.arq_worker.WorkerSettings"
    ARQ_WORKER_BOOT_ENV: str = "ARQ_WORKER_BOOTED"

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "app" / ".env"),
        extra="ignore",
    )


settings = Settings()


def resolve_redis_url(raw_url: str) -> str:
    """Use localhost when a Docker service hostname is configured outside Docker."""
    parsed = urlparse(raw_url)
    if parsed.hostname == "redis" and not os.path.exists("/.dockerenv"):
        netloc = "localhost"
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        if parsed.username or parsed.password:
            auth = parsed.username or ""
            if parsed.password:
                auth = f"{auth}:{parsed.password}"
            netloc = f"{auth}@{netloc}"
        return urlunparse(parsed._replace(netloc=netloc))

    return raw_url


def resolve_postgres_url(raw_url: str) -> str:
    """Normalize PostgreSQL URLs for Psycopg 3 and local Docker runs."""
    if raw_url.startswith("sqlite"):
        return raw_url
    parsed = urlparse(raw_url)
    if parsed.hostname in {"postgres", "db", "postgresql"} and not os.path.exists(
        "/.dockerenv"
    ):
        netloc = "localhost"
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        if parsed.username or parsed.password:
            auth = parsed.username or ""
            if parsed.password:
                auth = f"{auth}:{parsed.password}"
            netloc = f"{auth}@{netloc}"
        parsed = parsed._replace(netloc=netloc)

    if parsed.scheme in {"postgresql", "postgresql+psycopg2"}:
        parsed = parsed._replace(scheme="postgresql+psycopg")

    return urlunparse(parsed)
