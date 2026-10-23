import sqlite3

from app.config import settings


def test_default_display_name(client):
    assert client.get("/api/settings").json() == {"display_name": "Nikyana"}


def test_patch_persists_and_trims(client):
    r = client.patch("/api/settings", json={"display_name": "  Kesatria  "})
    assert r.status_code == 200
    assert r.json() == {"display_name": "Kesatria"}
    assert client.get("/api/settings").json() == {"display_name": "Kesatria"}


def test_patch_validation(client):
    assert client.patch("/api/settings", json={"display_name": ""}).status_code == 422
    assert client.patch("/api/settings", json={"display_name": "   "}).status_code == 422
    assert client.patch("/api/settings", json={"display_name": "x" * 41}).status_code == 422
    assert client.patch("/api/settings", json={"display_name": "x" * 40}).status_code == 200


def test_settings_auth_required(auth_client):
    c = auth_client
    assert c.get("/api/settings").status_code == 401
    assert c.patch("/api/settings", json={"display_name": "A"}).status_code == 401
    tok = c.post("/api/auth/login", json={"password": "secret"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert c.get("/api/settings", headers=h).status_code == 200
    assert c.patch("/api/settings", json={"display_name": "A"}, headers=h).status_code == 200


def test_migration_seed_idempotent_does_not_overwrite(client, tmp_path):
    # After a patch, re-running migrate() must not reset display_name.
    client.patch("/api/settings", json={"display_name": "Custom"})
    from app.migrations import migrate
    import app.db as dbmod

    engine = dbmod.make_engine(tmp_path)
    try:
        migrate(engine)
        con = sqlite3.connect(tmp_path / "app.db")
        try:
            row = con.execute(
                "SELECT value FROM settings WHERE key='display_name'"
            ).fetchone()
        finally:
            con.close()
        assert row[0] == "Custom"
    finally:
        engine.dispose()
