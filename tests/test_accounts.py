def test_catalog_product_sets_type_and_currency(api):
    # El cliente manda tipo y moneda incorrectos a propósito: el producto del catálogo manda.
    resp = api.post(
        "/accounts",
        {
            "name": "Chile USD",
            "type": "cash",
            "currency": "CLP",
            "balance": 100,
            "institution_id": "banco_chile",
            "product_id": "cuenta_corriente_usd",
        },
    )
    assert resp.status_code == 201
    account = resp.json()
    assert account["type"] == "bank"
    assert account["currency"] == "USD"
    assert account["institution_name"] == "Banco de Chile"
    assert account["balance_base"] == 95000  # 100 USD * 950


def test_invalid_catalog_combination_is_rejected(api):
    resp = api.post(
        "/accounts", {"name": "x", "type": "bank", "institution_id": "mach", "product_id": "cuentarut"}
    )
    assert resp.status_code == 422


def test_catalog_endpoint_lists_institutions_with_products(client):
    resp = client.get("/api/v1/catalog/institutions")
    assert resp.status_code == 200
    bancoestado = next(i for i in resp.json() if i["id"] == "bancoestado")
    assert any(p["name"] == "CuentaRUT" for p in bancoestado["products"])


def test_edit_account_assigns_institution_and_keeps_balance(api):
    account = api.account("Cuenta Principal", balance=500000)
    resp = api.patch(f"/accounts/{account['id']}", {"institution_id": "bancoestado", "product_id": "cuentarut"})
    assert resp.status_code == 200
    edited = resp.json()
    assert edited["product_name"] == "CuentaRUT"
    assert edited["balance"] == 500000


def test_currency_cannot_change_once_account_has_transactions(api):
    account = api.account(balance=1000)
    category = api.category()
    api.transaction(account["id"], category["id"], 100)

    resp = api.patch(
        f"/accounts/{account['id']}", {"institution_id": "banco_chile", "product_id": "cuenta_corriente_usd"}
    )
    assert resp.status_code == 422


def test_credit_limit_only_applies_to_credit_cards(api):
    card = api.account("Tarjeta", type="credit_card", balance=-100000, credit_limit=500000)
    cash = api.account("Efectivo", type="cash", balance=1000, credit_limit=99999)
    assert card["credit_limit"] == 500000
    assert cash["credit_limit"] is None

    # Si la tarjeta pasa a ser una cuenta vista, el cupo se borra.
    resp = api.patch(f"/accounts/{card['id']}", {"institution_id": "banco_falabella", "product_id": "cuenta_vista"})
    assert resp.json()["type"] == "bank"
    assert resp.json()["credit_limit"] is None


def test_credit_limit_must_be_positive(api):
    card = api.account("Tarjeta", type="credit_card")
    assert api.patch(f"/accounts/{card['id']}", {"credit_limit": -5}).status_code == 422


def test_users_only_see_their_own_accounts(client, api, make_user):
    mine = api.account("Mía")
    other = make_user("otro@example.com")

    assert client.get("/api/v1/accounts", headers=other).json() == []
    assert client.get(f"/api/v1/accounts/{mine['id']}", headers=other).status_code == 404
    assert client.patch(f"/api/v1/accounts/{mine['id']}", headers=other, json={"name": "hack"}).status_code == 404
    assert client.delete(f"/api/v1/accounts/{mine['id']}", headers=other).status_code == 404


def test_deleting_an_account_deletes_its_transactions(api):
    account = api.account(balance=1000)
    category = api.category()
    api.transaction(account["id"], category["id"], 100)

    assert api.delete(f"/accounts/{account['id']}").status_code == 204
    assert api.get("/transactions").json() == []
