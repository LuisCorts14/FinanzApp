import csv
import io


def test_defaults(api):
    assert api.get("/settings").json() == {
        "payday": None,
        "savings_target_pct": 20,
        "budget_alert_pct": 80,
        "default_account_id": None,
    }


def test_update_and_validate(api):
    account = api.account()
    resp = api.patch(
        "/settings", {"payday": 25, "savings_target_pct": 15, "budget_alert_pct": 90, "default_account_id": account["id"]}
    )
    assert resp.status_code == 200
    assert resp.json() == {"payday": 25, "savings_target_pct": 15, "budget_alert_pct": 90, "default_account_id": account["id"]}

    # Solo cambia lo que se envía; null limpia el día de pago.
    resp = api.patch("/settings", {"payday": None})
    assert resp.json()["payday"] is None and resp.json()["savings_target_pct"] == 15

    for bad in ({"payday": 0}, {"payday": 32}, {"savings_target_pct": 95}, {"budget_alert_pct": 40}):
        assert api.patch("/settings", bad).status_code == 422, bad


def test_default_account_must_be_mine_and_clears_when_deleted(client, api, make_user):
    other = make_user("otro@example.com")
    foreign = client.post("/api/v1/accounts", headers=other, json={"name": "Suya", "type": "bank", "balance": 0}).json()
    assert api.patch("/settings", {"default_account_id": foreign["id"]}).status_code == 404

    mine = api.account()
    api.patch("/settings", {"default_account_id": mine["id"]})
    api.delete(f"/accounts/{mine['id']}")
    assert api.get("/settings").json()["default_account_id"] is None


def test_export_includes_transactions_and_transfers(api, make_user, client):
    checking = api.account("RUT", balance=100000)
    card = api.account("Tarjeta", type="credit_card")
    food = api.category("Comida")
    salary = api.category("Sueldo", "income")
    api.transaction(checking["id"], food["id"], 12990, date="2026-10-02", description="Supermercado")
    api.transaction(checking["id"], salary["id"], 800000, date="2026-10-05")
    api.post("/transfers", {"from_account_id": checking["id"], "to_account_id": card["id"], "amount": 50000, "date": "2026-10-10"})
    # Datos de otra persona: no deben aparecer.
    other = make_user("otro@example.com")
    client.post("/api/v1/accounts", headers=other, json={"name": "Ajena", "type": "bank", "balance": 0})

    resp = api.get("/export/movements.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]

    text = resp.content.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))
    assert rows[0] == ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Cuenta destino", "Monto", "Moneda"]
    body = rows[1:]
    assert [r[1] for r in body] == ["Transferencia", "Ingreso", "Gasto"]  # más reciente primero
    assert body[0][4:7] == ["RUT", "Tarjeta", "50000.00"]
    assert body[2][2:4] == ["Supermercado", "Comida"] and body[2][6] == "-12990.00"
    assert "Ajena" not in text
