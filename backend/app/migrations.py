"""Ordered, idempotent migration runner using a schema_migrations table (no Alembic)."""
from sqlalchemy import text

from .db import Base, engine
from .models import DEFAULT_CATEGORIES  # imports register tables

MIGRATIONS: list[tuple[int, str]] = [
    (1, "initial schema"),
    (2, "seed display_name setting"),
]

DEFAULT_DISPLAY_NAME = "Nikyana"


def _apply(conn, eng, version: int) -> None:
    if version == 1:
        Base.metadata.create_all(eng, checkfirst=True)
        existing = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
        if existing == 0:
            for name, icon in DEFAULT_CATEGORIES:
                conn.execute(
                    text(
                        "INSERT INTO categories (name, icon, is_default) "
                        "VALUES (:n, :i, 1)"
                    ),
                    {"n": name, "i": icon},
                )
    elif version == 2:
        conn.execute(
            text(
                "INSERT INTO settings (key, value) SELECT :k, :v "
                "WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = :k)"
            ),
            {"k": "display_name", "v": DEFAULT_DISPLAY_NAME},
        )
    conn.execute(text("INSERT INTO schema_migrations (version) VALUES (:v)"), {"v": version})


def migrate(engine_=None):
    eng = engine_ or engine
    with eng.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version INTEGER PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        applied = {
            row[0]
            for row in conn.execute(text("SELECT version FROM schema_migrations"))
        }
        for version, _desc in MIGRATIONS:
            if version in applied:
                continue
            _apply(conn, eng, version)
    return applied


if __name__ == "__main__":
    migrate()
    print("migrations applied")
