def transfer(api, source, target, amount, **extra):
    return api.post(
        "/transfers",
        {"from_account_id": source["id"], "to_account_id": target["id"], "amount": amount, "date": "2026-10-20", **extra},
    )


def test_paying_the_card_moves_both_balances(api):
    checking = api.account("RUT", balance=500000)
    card = api.account("Tarjeta", type="credit_card", balance=-200000)

    assert transfer(api, checking, card, 150000).status_code == 201
    assert api.balance(checking["id"]) == 350000
    assert api.balance(card["id"]) == -50000


def test_edit_and_delete_revert_balances(api):
    checking = api.account("RUT", balance=500000)
    card = api.account("Tarjeta", type="credit_card", balance=-200000)
    t = transfer(api, checking, card, 150000).json()

    api.patch(f"/transfers/{t['id']}", {"amount": 200000})
    assert api.balance(checking["id"]) == 300000
    assert api.balance(card["id"]) == 0

    assert api.delete(f"/transfers/{t['id']}").status_code == 204
    assert api.balance(checking["id"]) == 500000
    assert api.balance(card["id"]) == -200000


def test_invalid_transfers_are_rejected(api):
    a = api.account("A", balance=1000)
    b = api.account("B")
    assert transfer(api, a, a, 100).status_code == 422
    assert transfer(api, a, b, 0).status_code == 422
    assert transfer(api, a, b, -50).status_code == 422


def test_cross_currency_transfer_needs_the_received_amount(api):
    clp = api.account("RUT", balance=100000)
    usd = api.account("Dólares", currency="USD")

    assert transfer(api, clp, usd, 95000).status_code == 422
    assert transfer(api, clp, usd, 95000, to_amount=100).status_code == 201
    assert api.balance(clp["id"]) == 5000
    assert api.balance(usd["id"]) == 100


def test_transfers_are_not_income_or_expense(api):
    a = api.account("A", balance=100000)
    b = api.account("B")
    transfer(api, a, b, 50000)

    assert api.get("/stats/monthly-summary").json() == []
    assert api.get("/stats/expenses-by-category", params={"month": "2026-10"}).json() == []


def test_list_transfers_by_account_and_month(api):
    a = api.account("A", balance=100000)
    b = api.account("B")
    c = api.account("C")
    transfer(api, a, b, 1000)
    transfer(api, b, c, 500)
    api.post("/transfers", {"from_account_id": a["id"], "to_account_id": c["id"], "amount": 10, "date": "2026-09-01"})

    assert len(api.get("/transfers", params={"account_id": b["id"]}).json()) == 2
    assert len(api.get("/transfers", params={"month": "2026-10"}).json()) == 2


def test_transfers_are_private(client, api, make_user):
    a = api.account("A", balance=1000)
    b = api.account("B")
    t = transfer(api, a, b, 100).json()
    other = make_user("otro@example.com")

    assert client.get("/api/v1/transfers", headers=other).json() == []
    assert client.delete(f"/api/v1/transfers/{t['id']}", headers=other).status_code == 404
    resp = client.post(
        "/api/v1/transfers",
        headers=other,
        json={"from_account_id": a["id"], "to_account_id": b["id"], "amount": 1, "date": "2026-10-20"},
    )
    assert resp.status_code == 404
