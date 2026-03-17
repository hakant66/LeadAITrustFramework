import os
from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://leadai:leadai@postgres:5432/leadai",
    )
    core_svc_url: str = os.getenv("CORE_SVC_URL", "http://core-svc:8001")
    trustmark_private_key: str = os.getenv("TRUSTMARK_PRIVATE_KEY", "")
    trustmark_public_key: str = os.getenv("TRUSTMARK_PUBLIC_KEY", "")
    trustmark_key_id: str = os.getenv("TRUSTMARK_KEY_ID", "default")
    auditor_token: str = os.getenv("TRUSTMARK_AUDITOR_TOKEN", "")


settings = Settings()
