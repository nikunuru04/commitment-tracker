import pytest
from datetime import date

from app import clock


def mk(client, name="Rent", amount_sen=120000, freq="monthly", start="2026-01-31", cat_id=None):
    cats = client.get("/api/categories").json()
    cid = cat_id or next(c["id"] for c in cats if c["name"] == "House")
    r = client.post(
        "/api/commitments",
        json={"name": name, "category_id": cid, "amount_sen": amount_sen,
              "frequency": freq, "start_date": start},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_health_and_categories_seeded(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "1.0.0"}
    cats = client.get("/api/categories").json()
    assert len(cats) == 11
    assert {c["name"] for c in cats} >= {"Loan", "House", "Other"}
    assert all(c["is_default"] == 1 for c in cats)


def test_category_crud_and_409_in_use(client):
    r = client.post("/api/categories", json={"name": "Hobbies", "icon": "Tag"})
    assert r.status_code == 201
    cid = r.json()["id"]
    assert client.post("/api/categories", json={"name": "Hobbies"}).status_code == 409

    mk(client, cat_id=cid)
    assert client.delete(f"/api/categories/{cid}").status_code == 409
    assert client.delete(f"/api/categories/{cid}").json()["detail"] == "Category is in use"

    r2 = client.post("/api/categories", json={"name": "Unused"})
    assert client.delete(f"/api/categories/{r2.json()['id']}").status_code == 204


def test_income_crud_and_month_filter(client):
    r = client.post("/api/incomes", json={"source_name": "Salary", "amount_sen": 500000,
                                          "income_date": "2026-10-25"})
    assert r.status_code == 201
    iid = r.json()["id"]
    client.post("/api/incomes", json={"source_name": "Bonus", "amount_sen": 100000,
                                      "income_date": "2026-09-15"})
    oct_only = client.get("/api/incomes", params={"month": "2026-10"}).json()
    assert len(oct_only) == 1 and oct_only[0]["id"] == iid
    assert client.patch(f"/api/incomes/{iid}", json={"amount_sen": 600000}).json()["amount_sen"] == 600000
    assert client.delete(f"/api/incomes/{iid}").status_code == 204
    assert client.get("/api/incomes", params={"month": "2026-10"}).json() == []


def test_pay_duplicate_and_unpay(client):
    c = mk(client, name="Car loan", amount_sen=90000, freq="monthly", start="2026-08-05")
    occ = "2026-10-05"
    r = client.post(f"/api/commitments/{c['id']}/pay", json={"occurrence_date": occ})
    assert r.status_code == 201
    txn = r.json()
    assert txn["type"] == "payment" and txn["description"] == "Payment: Car loan"
    assert client.post(f"/api/commitments/{c['id']}/pay", json={"occurrence_date": occ}).status_code == 409
    # unpay
    assert client.delete(f"/api/transactions/{txn['id']}").status_code == 204
    occs = client.get("/api/commitments/occurrences", params={"month": "2026-10"}).json()
    mine = [o for o in occs if o["commitment_id"] == c["id"] and o["occurrence_date"] == occ]
    assert mine and mine[0]["status"] in ("pending", "overdue")


def test_pay_invalid_occurrence_404(client):
    c = mk(client, freq="monthly", start="2026-01-31")
    assert client.post(f"/api/commitments/{c['id']}/pay",
                       json={"occurrence_date": "2026-10-30"}).status_code == 404


def test_commitment_delete_with_history_409_then_archive(client):
    c = mk(client, name="Wifi", amount_sen=15000, freq="monthly", start="2026-09-01")
    client.post(f"/api/commitments/{c['id']}/pay", json={"occurrence_date": "2026-10-01"})
    r = client.delete(f"/api/commitments/{c['id']}")
    assert r.status_code == 409
    assert r.json()["detail"] == "Commitment has payment history; archive it instead"
    assert client.patch(f"/api/commitments/{c['id']}", json={"archived": True}).json()["archived"] == 1


def test_commitment_404_unknown_category(client):
    r = client.post("/api/commitments", json={"name": "X", "category_id": 99999,
                                              "amount_sen": 100, "frequency": "monthly",
                                              "start_date": "2026-01-01"})
    assert r.status_code == 404


def test_expense_routes(client):
    cats = client.get("/api/categories").json()
    food = next(c["id"] for c in cats if c["name"] == "Food")
    r = client.post("/api/transactions", json={"type": "expense", "amount_sen": 2500,
                                               "txn_date": "2026-10-03", "category_id": food,
                                               "description": "Lunch"})
    assert r.status_code == 201
    # payment type rejected
    assert client.post("/api/transactions", json={"type": "payment", "amount_sen": 2500,
                                                  "txn_date": "2026-10-03"}).status_code == 400
    tid = r.json()["id"]
    assert client.patch(f"/api/transactions/{tid}", json={"amount_sen": 3000}).json()["amount_sen"] == 3000
    assert client.delete(f"/api/transactions/{tid}").status_code == 204


def test_savings_flow_and_delete_guards(client):
    r = client.post("/api/savings/goals", json={"name": "Emergency", "target_sen": 1000000})
    assert r.status_code == 201
    gid = r.json()["id"]
    assert client.post("/api/savings/allocations",
                       json={"goal_id": gid, "amount_sen": 50000,
                             "allocation_date": "2026-10-10"}).status_code == 201
    assert client.post("/api/savings/allocations",
                       json={"goal_id": gid, "amount_sen": 20000,
                             "allocation_date": "2026-09-10"}).status_code == 201
    goals = client.get("/api/savings/goals").json()
    assert goals[0]["allocated_total_sen"] == 70000
    assert client.delete(f"/api/savings/goals/{gid}").status_code == 409
    month_allocs = client.get("/api/savings/allocations", params={"month": "2026-10"}).json()
    assert len(month_allocs) == 1
    assert client.delete(f"/api/savings/goals/{gid}").json()["detail"] == "Goal has allocations"
