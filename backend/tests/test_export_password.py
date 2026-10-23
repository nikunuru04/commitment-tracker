from app.config import settings


def _seed(client):
    cats = client.get("/api/categories").json()
    client.post("/api/incomes", json={"source_name": "Salary", "amount_sen": 100000,
                                      "income_date": "2026-10-20"})
    client.post("/api/commitments", json={"name": "Rent", "category_id": cats[0]["id"],
                                          "amount_sen": 50000, "frequency": "monthly",
                                          "start_date": "2026-01-01"})
    client.post("/api/commitments/1/pay", json={"occurrence_date": "2026-10-01"})
    g = client.post("/api/savings/goals", json={"name": "Emergency"}).json()
    client.post("/api/savings/allocations",
                json={"goal_id": g["id"], "amount_sen": 10000, "allocation_date": "2026-10-15"})


def test_export_roundtrip_and_no_secrets(client):
    _seed(client)
    r = client.get("/api/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert "attachment" in r.headers["content-disposition"]
    assert "commitment-tracker-export.json" in r.headers["content-disposition"]
    data = r.json()["data"]
    assert "exported_at" in r.json()
    assert set(data.keys()) == {
        "categories", "incomes", "commitments", "transactions",
        "savings_goals", "savings_allocations",
    }
    assert len(data["categories"]) == 11
    assert len(data["incomes"]) == 1
    assert len(data["commitments"]) == 1
    assert len(data["transactions"]) == 1
    assert len(data["savings_goals"]) == 1
    assert len(data["savings_allocations"]) == 1
    raw = r.text
    assert "auth_token" not in raw and "auth_password_hash" not in raw and "settings" not in data


def test_password_change_flow(auth_client):
    c = auth_client
    tok = c.post("/api/auth/login", json={"password": "secret"}).json()["token"]
    headers = {"Authorization": f"Bearer {tok}"}
    # wrong old → 401
    assert c.patch("/api/settings/password",
                   json={"old_password": "nope", "new_password": "newsecret1"},
                   headers=headers).status_code == 401
    # short new → 400 (pydantic min 8 → 422 also acceptable)
    r = c.patch("/api/settings/password",
                json={"old_password": "secret", "new_password": "short"},
                headers=headers)
    assert r.status_code in (400, 422)
    # success → 204, old token rejected, new login works
    assert c.patch("/api/settings/password",
                   json={"old_password": "secret", "new_password": "newsecret1"},
                   headers=headers).status_code == 204
    assert c.get("/api/categories", headers=headers).status_code == 401
    tok2 = c.post("/api/auth/login", json={"password": "newsecret1"}).json()["token"]
    assert c.get("/api/categories", headers={"Authorization": f"Bearer {tok2}"}).status_code == 200
    # old password no longer works; hash persisted in settings
    assert c.post("/api/auth/login", json={"password": "secret"}).status_code == 401


def test_stored_hash_precedence_over_env(client, monkeypatch, tmp_path):
    # Login with env password bootstraps the hash.
    monkeypatch.setattr(settings, "APP_PASSWORD", "envpass1")
    r = client.post("/api/auth/login", json={"password": "envpass1"})
    assert r.status_code == 200
    # Change env — stored hash must still win.
    monkeypatch.setattr(settings, "APP_PASSWORD", "changedenv")
    assert client.post("/api/auth/login", json={"password": "changedenv"}).status_code == 401
    assert client.post("/api/auth/login", json={"password": "envpass1"}).status_code == 200
    # Stored hash format check (read the test DB directly; matches fixture's tmp_path engine).
    import sqlite3
    con = sqlite3.connect(tmp_path / "app.db")
    try:
        row = con.execute(
            "SELECT value FROM settings WHERE key='auth_password_hash'"
        ).fetchone()
    finally:
        con.close()
    stored = row[0] if row else None
    assert stored and stored.startswith("pbkdf2_sha256$200000$")


def test_auth_enabled_follows_hash(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_PASSWORD", None)
    # no password at all → auth disabled
    assert client.get("/api/auth/status").json() == {"auth_required": False}
    assert client.patch("/api/settings/password",
                        json={"old_password": "x", "new_password": "longenough1"}).status_code == 400
