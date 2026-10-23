import os
import tempfile
from pathlib import Path

import pytest

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="ct-test-data-")
os.environ["APP_PASSWORD"] = ""  # auth off by default; auth tests use monkeypatched env

from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal, make_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.migrations import migrate  # noqa: E402


@pytest.fixture()
def client(monkeypatch, tmp_path):
    """Fresh app + DB per test, auth disabled."""
    monkeypatch.setattr(settings, "APP_PASSWORD", None)
    engine = make_engine(tmp_path)
    migrate(engine)

    import app.db as dbmod

    test_session = dbmod.sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[dbmod.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    engine.dispose()


@pytest.fixture()
def auth_client(monkeypatch, tmp_path):
    """Fresh app + DB per test, auth ENABLED with password 'secret'."""
    monkeypatch.setattr(settings, "APP_PASSWORD", "secret")
    engine = make_engine(tmp_path)
    migrate(engine)

    import app.db as dbmod

    test_session = dbmod.sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[dbmod.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    engine.dispose()


@pytest.fixture()
def db(client):
    return SessionLocal
