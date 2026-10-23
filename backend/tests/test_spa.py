"""SPA static-serving regression tests (frontend/dist + catch-all fallback)."""

import pytest

from app.config import settings
from app.db import make_engine
from app.main import create_app
from app.migrations import migrate


@pytest.fixture()
def static_client(monkeypatch, tmp_path):
    """App with STATIC_DIR pointing at a tiny fake dist; auth off; fresh DB."""
    monkeypatch.setattr(settings, "APP_PASSWORD", None)
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html><body>spa</body></html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setattr(settings, "STATIC_DIR", str(dist))

    engine = make_engine(tmp_path / "db.sqlite3")
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
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
    engine.dispose()


def test_spa_serves_index_for_client_routes(static_client):
    r = static_client.get("/income")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "spa" in r.text


def test_spa_root_serves_index(static_client):
    r = static_client.get("/")
    assert r.status_code == 200
    assert "spa" in r.text


def test_spa_serves_real_asset_files(static_client):
    r = static_client.get("/assets/app.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]


def test_api_404_stays_json(static_client):
    r = static_client.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}
