def goal(api, **fields):
    resp = api.post(
        "/savings-goals", {"name": "Fondo de emergencia", "target_amount": 1000000, "target_date": "2027-06-30", **fields}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def contribute(api, goal_id, amount, date="2026-10-10", note=None):
    return api.post(f"/savings-goals/{goal_id}/contributions", {"amount": amount, "date": date, "note": note})


def test_goal_progress_is_the_sum_of_contributions(api):
    g = goal(api)
    contribute(api, g["id"], 100000)
    contribute(api, g["id"], 50000)
    contribute(api, g["id"], -30000, note="Imprevisto")

    assert api.get(f"/savings-goals/{g['id']}").json()["current_amount"] == 120000
    history = api.get(f"/savings-goals/{g['id']}/contributions").json()
    assert [c["amount"] for c in history] == [100000, 50000, -30000]


def test_cannot_withdraw_more_than_saved_or_contribute_zero(api):
    g = goal(api)
    contribute(api, g["id"], 10000)
    assert contribute(api, g["id"], -20000).status_code == 422
    assert contribute(api, g["id"], 0).status_code == 422


def test_deleting_a_contribution_updates_progress(api):
    g = goal(api)
    c = contribute(api, g["id"], 10000).json()
    assert api.delete(f"/savings-goals/{g['id']}/contributions/{c['id']}").status_code == 204
    assert api.get(f"/savings-goals/{g['id']}").json()["current_amount"] == 0


def test_goal_linked_to_an_account_uses_its_balance(api):
    savings = api.account("Ahorro", type="savings", balance=200000)
    checking = api.account("RUT", balance=500000)
    g = goal(api, account_id=savings["id"])

    # No acepta abonos: el avance sale del saldo de la cuenta.
    assert contribute(api, g["id"], 1000).status_code == 400

    api.post(
        "/transfers",
        {"from_account_id": checking["id"], "to_account_id": savings["id"], "amount": 50000, "date": "2026-10-20"},
    )
    refreshed = api.get(f"/savings-goals/{g['id']}").json()
    assert refreshed["current_amount"] == 250000
    # El plan parte desde lo que había al crear la meta, no desde cero.
    assert refreshed["start_amount"] == 200000


def test_goals_are_private(client, api, make_user):
    g = goal(api)
    other = make_user("otro@example.com")
    assert client.get(f"/api/v1/savings-goals/{g['id']}", headers=other).status_code == 404
    resp = client.post(
        f"/api/v1/savings-goals/{g['id']}/contributions", headers=other, json={"amount": 1, "date": "2026-10-10"}
    )
    assert resp.status_code == 404
