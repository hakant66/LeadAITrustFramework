import os
from pydantic import BaseModel

class Settings(BaseModel):
    pg_host: str = os.getenv("PGHOST", "localhost")
    pg_port: int = int(os.getenv("PGPORT", "5432"))
    pg_user: str = os.getenv("PGUSER", "leadai")
    pg_password: str = os.getenv("PGPASSWORD", "leadai")
    pg_db: str = os.getenv("PGDATABASE", "leadai")

    @property
    def sqlalchemy_url(self) -> str:
        return f"postgresql+psycopg://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"

settings = Settings()
