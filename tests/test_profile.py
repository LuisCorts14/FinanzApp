def test_update_name(client, auth):
    resp = client.patch("/api/v1/auth/me", headers=auth, json={"full_name": "  Ana María  "})
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Ana María"

    # Un nombre vacío se guarda como "sin nombre".
    assert client.patch("/api/v1/auth/me", headers=auth, json={"full_name": " "}).json()["full_name"] is None


def test_changing_email_requires_the_current_password(client, make_user):
    auth = make_user("ana@example.com", password="secreta123")

    no_password = client.patch("/api/v1/auth/me", headers=auth, json={"email": "nueva@example.com"})
    assert no_password.status_code == 400
    wrong = client.patch(
        "/api/v1/auth/me", headers=auth, json={"email": "nueva@example.com", "current_password": "incorrecta"}
    )
    assert wrong.status_code == 400

    ok = client.patch(
        "/api/v1/auth/me", headers=auth, json={"email": "nueva@example.com", "current_password": "secreta123"}
    )
    assert ok.status_code == 200 and ok.json()["email"] == "nueva@example.com"
    login = client.post("/api/v1/auth/login", json={"email": "nueva@example.com", "password": "secreta123"})
    assert login.status_code == 200


def test_cannot_take_another_users_email(client, make_user):
    make_user("ocupado@example.com")
    auth = make_user("ana@example.com", password="secreta123")
    resp = client.patch(
        "/api/v1/auth/me", headers=auth, json={"email": "OCUPADO@example.com", "current_password": "secreta123"}
    )
    assert resp.status_code == 409


def test_change_password_logs_out_other_sessions_but_keeps_this_one(client, make_user):
    this_device = make_user("ana@example.com", password="vieja1234")
    other_login = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "vieja1234"})
    other_device = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

    wrong = client.post(
        "/api/v1/auth/change-password", headers=this_device, json={"current_password": "x", "new_password": "nueva1234"}
    )
    assert wrong.status_code == 400  # 400, no 401: escribir mal la contraseña no debe cerrar la sesión

    resp = client.post(
        "/api/v1/auth/change-password",
        headers=this_device,
        json={"current_password": "vieja1234", "new_password": "nueva1234"},
    )
    assert resp.status_code == 200
    new_token = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    assert client.get("/api/v1/auth/me", headers=new_token).status_code == 200
    assert client.get("/api/v1/auth/me", headers=this_device).status_code == 401
    assert client.get("/api/v1/auth/me", headers=other_device).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "nueva1234"}).status_code == 200


def test_new_password_must_have_minimum_length(client, auth):
    resp = client.post(
        "/api/v1/auth/change-password", headers=auth, json={"current_password": "secreta123", "new_password": "123"}
    )
    assert resp.status_code == 422
    assert client.post("/api/v1/auth/register", json={"email": "corta@example.com", "password": "123"}).status_code == 422


def test_password_reset_also_closes_open_sessions(client, make_user, sent_emails):
    from urllib.parse import parse_qs, urlparse

    session = make_user("ana@example.com", password="vieja1234")
    client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"})
    token = parse_qs(urlparse(sent_emails[0][1]).query)["token"][0]
    client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "nueva1234"})

    assert client.get("/api/v1/auth/me", headers=session).status_code == 401


def test_summary_counts_only_my_data(client, api, make_user):
    a = api.account("A", balance=1000)
    b = api.account("B")
    food = api.category()
    api.transaction(a["id"], food["id"], 100)
    api.post("/transfers", {"from_account_id": a["id"], "to_account_id": b["id"], "amount": 50, "date": "2026-10-10"})
    api.post("/savings-goals", {"name": "Meta", "target_amount": 1000, "target_date": "2027-01-01"})
    make_user("otro@example.com")

    assert api.get("/auth/me/summary").json() == {
        "accounts": 2,
        "transactions": 1,
        "transfers": 1,
        "categories": 1,
        "savings_goals": 1,
    }


def test_delete_account_removes_everything_and_requires_password(client, api, auth, make_user):
    account = api.account(balance=1000)
    api.transaction(account["id"], api.category()["id"], 100)
    other = make_user("otro@example.com")
    client.post("/api/v1/accounts", headers=other, json={"name": "Suya", "type": "bank", "balance": 0})

    assert client.post("/api/v1/auth/delete-account", headers=auth, json={"password": "incorrecta"}).status_code == 400
    assert client.post("/api/v1/auth/delete-account", headers=auth, json={"password": "secreta123"}).status_code == 204

    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "secreta123"}).status_code == 401
    # Los datos de otras personas no se tocan.
    assert len(client.get("/api/v1/accounts", headers=other).json()) == 1
