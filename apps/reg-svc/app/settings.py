import os
from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://leadai:leadai@postgres:5432/leadai",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    celery_queue: str = os.getenv("TRUST_DECAY_QUEUE", "trust_decay")
    core_svc_url: str = os.getenv("CORE_SVC_URL", "http://core-svc:8001")


settings = Settings()
