from datetime import date

import pytest
from sqlalchemy import text

from app.db.session import engine

TODAY = date(2026, 10, 20)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr("app.services.notifications._today", lambda: TODAY)


def kinds(api):
    return {n["kind"]: n for n in api.get("/notifications").json()["items"]}


def test_budget_warning_and_exceeded(api):
    account = api.account(balance=500000)
    food = api.category("Comida", monthly_budget=100000)
    fun = api.category("Ocio", monthly_budget=50000)
    api.transaction(account["id"], food["id"], 85000, date="2026-10-05")  # 85% (aviso por defecto: 80%)
    api.transaction(account["id"], fun["id"], 60000, date="2026-10-06")  # 120%
    api.transaction(account["id"], food["id"], 999999, date="2026-09-06")  # otro mes: no cuenta

    found = kinds(api)
    assert found["budget_warning"]["title"] == "Comida: ya usaste el 85% del presupuesto"
    assert "Ocio" in found["budget_exceeded"]["title"]
    assert found["budget_exceeded"]["severity"] == "critical"


def test_budget_warning_respects_the_users_threshold(api):
    account = api.account(balance=500000)
    food = api.category("Comida", monthly_budget=100000)
    api.transaction(account["id"], food["id"], 85000, date="2026-10-05")
    api.patch("/settings", {"budget_alert_pct": 90})
    assert "budget_warning" not in kinds(api)


def test_overspending(api):
    account = api.account()
    food = api.category("Comida")
    salary = api.category("Sueldo", "income")
    api.transaction(account["id"], salary["id"], 400000, date="2026-10-01")
    api.transaction(account["id"], food["id"], 450000, date="2026-10-02")
    assert kinds(api)["overspending"]["severity"] == "critical"


def test_credit_card_usage(api):
    api.account("Tarjeta A", type="credit_card", balance=-420000, credit_limit=500000)  # 84%
    api.account("Tarjeta B", type="credit_card", balance=-600000, credit_limit=500000)  # excedida
    api.account("Tarjeta C", type="credit_card", balance=-50000, credit_limit=500000)  # 10%: sin aviso
    items = api.get("/notifications").json()["items"]
    titles = [n["title"] for n in items if n["kind"].startswith("card")]
    assert titles == ["Superaste el cupo de Tarjeta B", "Tarjeta A: usas el 84% del cupo"]


def test_goal_behind_and_done(api, auth):
    behind = api.post("/savings-goals", {"name": "Viaje", "target_amount": 1200000, "target_date": "2027-04-20"}).json()
    done = api.post("/savings-goals", {"name": "Bici", "target_amount": 100000, "target_date": "2027-01-01"}).json()
    api.post(f"/savings-goals/{done['id']}/contributions", {"amount": 100000, "date": "2026-10-01"})
    # La meta "Viaje" se creó hace 3 meses y no tiene abonos: va atrasada.
    with engine.begin() as conn:
        conn.execute(text("UPDATE savings_goals SET created_at = '2026-07-20' WHERE id = :id"), {"id": behind["id"]})

    found = kinds(api)
    assert found["goal_behind"]["link"] == f"/ahorros/{behind['id']}"
    assert "Abona" in found["goal_behind"]["message"]
    assert found["goal_done"]["title"] == "¡Cumpliste tu meta Bici!"


def test_payday_reminder_only_close_to_payday(api):
    api.patch("/settings", {"payday": 21})
    assert kinds(api)["payday"]["title"] == "Tu sueldo llega mañana"
    api.patch("/settings", {"payday": 28})
    assert "payday" not in kinds(api)


def test_inactivity(api):
    account = api.account()
    assert kinds(api)["inactive"]["key"] == "inactive:never"

    tx = api.transaction(account["id"], api.category()["id"], 1000, date="2026-10-01")
    with engine.begin() as conn:
        conn.execute(text("UPDATE transactions SET created_at = '2026-10-10' WHERE id = :id"), {"id": tx["id"]})
    assert kinds(api)["inactive"]["title"] == "Llevas 10 días sin registrar movimientos"


def test_mark_read(client, api, make_user):
    api.account("Tarjeta", type="credit_card", balance=-450000, credit_limit=500000)
    api.patch("/settings", {"payday": 21})
    data = api.get("/notifications").json()
    # Cupo alto, sueldo mañana y "registra tu primer movimiento".
    assert data["unread_count"] == 3

    card_key = next(n["key"] for n in data["items"] if n["kind"] == "card_high")
    assert api.post("/notifications/read", {"keys": [card_key, "inventada:123"]}).status_code == 204
    data = api.get("/notifications").json()
    assert data["unread_count"] == 2
    assert next(n for n in data["items"] if n["key"] == card_key)["read"] is True

    api.post("/notifications/read", {})
    assert api.get("/notifications").json()["unread_count"] == 0

    # Lo que leyó una persona no afecta a otra.
    other = make_user("otro@example.com")
    client.post("/api/v1/accounts", headers=other, json={"name": "T", "type": "credit_card", "balance": -450000, "credit_limit": 500000})
    assert client.get("/api/v1/notifications", headers=other).json()["unread_count"] >= 1


def test_same_problem_next_month_is_a_new_notification(api, monkeypatch):
    account = api.account(balance=500000)
    fun = api.category("Ocio", monthly_budget=10000)
    api.transaction(account["id"], fun["id"], 20000, date="2026-10-05")
    api.transaction(account["id"], fun["id"], 20000, date="2026-11-05")
    api.post("/notifications/read", {})
    assert api.get("/notifications").json()["unread_count"] == 0

    monkeypatch.setattr("app.services.notifications._today", lambda: date(2026, 11, 10))
    unread = [n for n in api.get("/notifications").json()["items"] if not n["read"]]
    assert [n["key"] for n in unread if n["kind"] == "budget_exceeded"] == [f"budget_exceeded:{fun['id']}:2026-11"]
