from app.config import settings


def test_auth_disabled(client):
    assert client.get("/api/auth/status").json() == {"auth_required": False}
    assert client.get("/api/categories").status_code == 200


def test_auth_enabled_flow(auth_client):
    c = auth_client
    assert c.get("/api/auth/status").json() == {"auth_required": True}
    # no token → 401
    assert c.get("/api/categories").status_code == 401
    assert c.get("/api/categories").json() == {"detail": "Not authenticated"}
    # wrong password
    assert c.post("/api/auth/login", json={"password": "nope"}).status_code == 401
    # correct
    tok = c.post("/api/auth/login", json={"password": "secret"}).json()["token"]
    # token persisted & stable
    tok2 = c.post("/api/auth/login", json={"password": "secret"}).json()["token"]
    assert tok == tok2 and len(tok) == 64
    assert c.get("/api/categories", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
    assert c.get("/api/categories", headers={"Authorization": "Bearer bad"}).status_code == 401
    # health stays open
    assert c.get("/api/health").status_code == 200
