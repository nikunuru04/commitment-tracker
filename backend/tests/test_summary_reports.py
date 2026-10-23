from datetime import date, timedelta

from app import clock


def _setup(client):
    cats = client.get("/api/categories").json()
    house = next(c["id"] for c in cats if c["name"] == "House")
    car = next(c["id"] for c in cats if c["name"] == "Car")
    client.post("/api/incomes", json={"source_name": "Salary", "amount_sen": 800000,
                                      "income_date": "2026-10-25"})
    client.post("/api/incomes", json={"source_name": "Side gig", "amount_sen": 100000,
                                      "income_date": "2026-10-05"})
    # Rent monthly 1500.00 RM on the 1st; Car weekly 300.00 RM Fridays
    client.post("/api/commitments", json={"name": "Rent", "category_id": house,
                                          "amount_sen": 150000, "frequency": "monthly",
                                          "start_date": "2026-01-01"})
    r = client.post("/api/commitments", json={"name": "Petrol", "category_id": car,
                                              "amount_sen": 30000, "frequency": "weekly",
                                              "start_date": "2026-10-02"})
    petrol_id = r.json()["id"]
    # Savings 100.00 RM in Oct
    g = client.post("/api/savings/goals", json={"name": "Emergency"}).json()
    client.post("/api/savings/allocations",
                json={"goal_id": g["id"], "amount_sen": 10000, "allocation_date": "2026-10-15"})
    return petrol_id


def test_summary_math(client):
    _setup(client)
    s = client.get("/api/summary", params={"month": "2026-10"}).json()
    # Oct 2026: Fridays = 2,9,16,23,30 → petrol weekly starts Oct 2 → 5 occurrences
    assert s["total_income_sen"] == 900000
    assert s["total_commitments_sen"] == 150000 + 5 * 30000
    assert s["total_savings_sen"] == 10000
    assert s["available_sen"] == 900000 - 300000 - 10000
    assert s["income_count"] == 2
    breakdown = {b["category_name"]: b["amount_sen"] for b in s["category_breakdown"]}
    assert breakdown == {"House": 150000, "Car": 150000}
    # sorted desc
    amounts = [b["amount_sen"] for b in s["category_breakdown"]]
    assert amounts == sorted(amounts, reverse=True)
    sbg = s["savings_by_goal"][0]
    assert sbg["allocated_this_month_sen"] == 10000 and sbg["allocated_total_sen"] == 10000


def test_summary_zeroed_empty_month(client):
    s = client.get("/api/summary", params={"month": "2030-01"}).json()
    assert s["total_income_sen"] == 0
    assert s["total_commitments_sen"] == 0
    assert s["total_savings_sen"] == 0
    assert s["available_sen"] == 0
    assert s["category_breakdown"] == [] and s["savings_by_goal"] == []


def test_summary_negative_available(client):
    client.post("/api/commitments", json={"name": "Big", "category_id": 1,
                                          "amount_sen": 999999, "frequency": "one_time",
                                          "start_date": "2026-03-01"})
    s = client.get("/api/summary", params={"month": "2026-03"}).json()
    assert s["available_sen"] == -999999


def test_summary_month_required_and_validated(client):
    assert client.get("/api/summary").status_code == 422
    assert client.get("/api/summary", params={"month": "2026-13"}).status_code == 422
    assert client.get("/api/summary", params={"month": "26-10"}).status_code == 422


def test_upcoming_and_occurrences_statuses(client):
    # one_time commitment dated in month window around today
    today = clock.today()
    cats = client.get("/api/categories").json()
    future_date = today + timedelta(days=5)
    past_date = today - timedelta(days=5)
    client.post("/api/commitments", json={"name": "Future", "category_id": cats[0]["id"],
                                          "amount_sen": 5000, "frequency": "one_time",
                                          "start_date": future_date.isoformat()})
    client.post("/api/commitments", json={"name": "Past", "category_id": cats[0]["id"],
                                          "amount_sen": 7000, "frequency": "one_time",
                                          "start_date": past_date.isoformat()})
    s = client.get("/api/summary", params={"month": f"{today:%Y-%m}"}).json()
    up = {u["commitment_name"]: u for u in s["upcoming"]}
    assert "Future" in up and "Past" not in up
    assert up["Future"]["status"] == "pending"

    occs = client.get("/api/commitments/occurrences", params={"month": f"{today:%Y-%m}"}).json()
    by_name = {o["commitment_name"]: o for o in occs}
    assert by_name["Past"]["status"] == "overdue"
    assert by_name["Future"]["status"] == "pending"
    # pay the past one → paid
    r = client.post(f"/api/commitments/{by_name['Past']['commitment_id']}/pay",
                    json={"occurrence_date": past_date.isoformat()})
    assert r.status_code == 201
    occs = client.get("/api/commitments/occurrences", params={"month": f"{today:%Y-%m}"}).json()
    by_name = {o["commitment_name"]: o for o in occs}
    assert by_name["Past"]["status"] == "paid"
    assert by_name["Past"]["payment_id"] is not None


def test_monthly_report_and_history(client):
    _setup(client)
    r = client.get("/api/reports/monthly", params={"month": "2026-10"}).json()
    assert r["prev_month"] == "2026-09"
    # Sep: rent 150000 only (petrol starts Oct)
    assert r["prev_total_commitments_sen"] == 150000
    assert r["prev_total_income_sen"] == 0
    assert r["planned_sen"] == 300000
    assert r["paid_sen"] == 0 and r["payment_count"] == 0
    h = client.get("/api/reports/history", params={"month": "2026-10", "months": 3}).json()
    assert [x["month"] for x in h] == ["2026-08", "2026-09", "2026-10"]
    assert h[2]["income_sen"] == 900000 and h[2]["commitments_sen"] == 300000
    assert h[1]["commitments_sen"] == 150000 and h[1]["available_sen"] == -150000
