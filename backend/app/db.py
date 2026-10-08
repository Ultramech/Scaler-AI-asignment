"""SQLite engine, session factory, and a tiny additive migration helper."""
import os
from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("ROUTE53_DATABASE_URL", "sqlite:///./route53.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first release. `create_all` never alters existing tables,
# so databases created by an older version get these added on startup.
ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "hosted_zones": {
        "query_log_group": "VARCHAR NOT NULL DEFAULT ''",
        "accelerated_recovery": "BOOLEAN NOT NULL DEFAULT 0",
        "dnssec_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "dnssec_ksk_name": "VARCHAR NOT NULL DEFAULT ''",
        "dnssec_enabled_at": "DATETIME",
        "vpc_region": "VARCHAR NOT NULL DEFAULT ''",
        "vpc_id": "VARCHAR NOT NULL DEFAULT ''",
    },
    "dns_records": {
        "alias": "BOOLEAN NOT NULL DEFAULT 0",
        "evaluate_target_health": "BOOLEAN NOT NULL DEFAULT 0",
        "set_identifier": "VARCHAR NOT NULL DEFAULT ''",
    },
}


def migrate() -> None:
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table, columns in ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
