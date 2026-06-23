import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    is_render = bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID"))
    if is_render:
        raise RuntimeError(
            "DATABASE_URL is required on Render. Attach a persistent PostgreSQL "
            "database and set DATABASE_URL to its internal connection URL."
        )

    # SQLite is only a local-development fallback. Render disks are ephemeral.
    os.makedirs("/app/storage", exist_ok=True)
    DATABASE_URL = "sqlite:////app/storage/analytics.db"

# SQLite requires check_same_thread=False
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
