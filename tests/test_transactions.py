def test_balance_follows_transactions(api):
    account = api.account(balance=100000)
    food = api.category("Comida", "expense")
    salary = api.category("Sueldo", "income")

    api.transaction(account["id"], food["id"], 30000)
    api.transaction(account["id"], salary["id"], 500000)
    assert api.balance(account["id"]) == 570000


def test_editing_a_transaction_recalculates_the_balance(api):
    account = api.account(balance=100000)
    food = api.category("Comida", "expense")
    salary = api.category("Sueldo", "income")
    tx = api.transaction(account["id"], food["id"], 30000)

    api.patch(f"/transactions/{tx['id']}", {"amount": 50000})
    assert api.balance(account["id"]) == 50000

    # Cambiar a una categoría de ingreso invierte el efecto en el saldo.
    api.patch(f"/transactions/{tx['id']}", {"category_id": salary["id"]})
    assert api.balance(account["id"]) == 150000


def test_deleting_a_transaction_reverts_the_balance(api):
    account = api.account(balance=100000)
    food = api.category()
    tx = api.transaction(account["id"], food["id"], 30000)

    assert api.delete(f"/transactions/{tx['id']}").status_code == 204
    assert api.balance(account["id"]) == 100000


def test_list_filters_by_month_and_account(api):
    a = api.account("A")
    b = api.account("B")
    food = api.category()
    api.transaction(a["id"], food["id"], 1000, date="2026-09-30")
    api.transaction(a["id"], food["id"], 2000, date="2026-10-01")
    api.transaction(b["id"], food["id"], 3000, date="2026-10-31")

    october = api.get("/transactions", params={"month": "2026-10"}).json()
    assert sorted(t["amount"] for t in october) == [2000, 3000]
    only_a = api.get("/transactions", params={"account_id": a["id"]}).json()
    assert sorted(t["amount"] for t in only_a) == [1000, 2000]


def test_cannot_use_another_users_account_or_category(client, api, make_user):
    my_account = api.account()
    my_category = api.category()
    other = make_user("otro@example.com")
    other_account = client.post(
        "/api/v1/accounts", headers=other, json={"name": "Suya", "type": "bank", "balance": 0}
    ).json()

    resp = client.post(
        "/api/v1/transactions",
        headers=other,
        json={"account_id": my_account["id"], "category_id": my_category["id"], "amount": 1, "date": "2026-10-01"},
    )
    assert resp.status_code == 404
    resp = client.post(
        "/api/v1/transactions",
        headers=other,
        json={"account_id": other_account["id"], "category_id": my_category["id"], "amount": 1, "date": "2026-10-01"},
    )
    assert resp.status_code == 404
