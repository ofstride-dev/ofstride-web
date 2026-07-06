from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    env: str = Field(default="dev", alias="ENV")

    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    azure_openai_api_key: str | None = Field(default=None, alias="AZURE_OPENAI_API_KEY")
    azure_openai_endpoint: str | None = Field(default=None, alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_version: str = Field(default="2024-12-01-preview", alias="AZURE_OPENAI_API_VERSION")
    azure_openai_deployment: str | None = Field(default=None, alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_embedding_deployment: str | None = Field(
        default=None,
        alias="AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
    )
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    model_name: str = Field(default="gpt-4o-mini", alias="MODEL_NAME")
    fallback_model_name: str = Field(default="gpt-4o-mini", alias="FALLBACK_MODEL_NAME")
    temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")
    max_tokens: int = Field(default=700, alias="LLM_MAX_TOKENS")

    embedding_model: str = Field(default="text-embedding-3-small", alias="EMBEDDING_MODEL")
    embedding_dimension: int = Field(default=1536, alias="EMBEDDING_DIMENSION")

    qdrant_url: str | None = Field(default=None, alias="QDRANT_URL")
    qdrant_api_key: str | None = Field(default=None, alias="QDRANT_API_KEY")
    qdrant_collection: str = Field(default="ofstride_consultants", alias="QDRANT_COLLECTION")

    retrieval_k: int = Field(default=6, alias="RETRIEVAL_K")
    retrieval_max_context_chars: int = Field(default=7000, alias="RETRIEVAL_MAX_CONTEXT_CHARS")
    source_snippet_chars: int = Field(default=420, alias="SOURCE_SNIPPET_CHARS")

    allowed_origins: str = Field(
        default="http://localhost:5173,http://localhost:4280",
        alias="ALLOWED_ORIGINS",
    )

    ingest_shared_secret: str | None = Field(default=None, alias="INGEST_SHARED_SECRET")
    ingest_max_file_bytes: int = Field(default=5 * 1024 * 1024, alias="INGEST_MAX_FILE_BYTES")
    ingest_allowed_extensions: str = Field(
        default=".pdf,.csv,.xlsx,.xls,.txt,.md,.ppt,.pptx",
        alias="INGEST_ALLOWED_EXTENSIONS",
    )

    rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")
    rate_limit_window_seconds: int = Field(default=60, alias="RATE_LIMIT_WINDOW_SECONDS")
    rate_limit_requests_per_window: int = Field(default=30, alias="RATE_LIMIT_REQUESTS_PER_WINDOW")

    llm_timeout_seconds: int = Field(default=30, alias="LLM_TIMEOUT_SECONDS")
    llm_circuit_fail_threshold: int = Field(default=3, alias="LLM_CIRCUIT_FAIL_THRESHOLD")
    llm_circuit_reset_seconds: int = Field(default=90, alias="LLM_CIRCUIT_RESET_SECONDS")

    allow_mock_provider: bool = Field(default=True, alias="ALLOW_MOCK_PROVIDER")
    use_inmemory_vector_store: bool = Field(default=True, alias="USE_INMEMORY_VECTOR_STORE")
    session_ttl_minutes: int = Field(default=30, alias="SESSION_TTL_MINUTES")
    session_max_messages: int = Field(default=16, alias="SESSION_MAX_MESSAGES")

    ingest_chunk_size: int = Field(default=1400, alias="INGEST_CHUNK_SIZE")
    ingest_chunk_overlap: int = Field(default=200, alias="INGEST_CHUNK_OVERLAP")

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(API_ROOT / ".env"), ".env"),
        extra="ignore",
    )


settings = Settings()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return settings
