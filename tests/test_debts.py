from app.services.debt_plan import DebtInput, simulate


def debt(key, balance, rate, minimum):
    return DebtInput(key, key, balance, rate, minimum)


# --- Simulación ---


def test_debt_without_interest_is_paid_with_the_budget():
    result = simulate([debt("a", 1000, 0, 100)], budget=300, strategy="avalanche")
    assert result.status == "ok"
    assert result.months == 4  # 300 + 300 + 300 + 100
    assert result.total_paid == 1000
    assert result.total_interest == 0
    assert result.timeline == [1000, 700, 400, 100, 0]


def test_interest_is_added_before_each_payment():
    result = simulate([debt("a", 1000, 10, 100)], budget=600, strategy="avalanche")
    # Mes 1: 1000 + 100 de interés - 600 = 500. Mes 2: 500 + 50 = 550, se paga completo.
    assert result.months == 2
    assert result.total_interest == 150
    assert result.total_paid == 1150


def test_snowball_pays_the_smallest_first_and_avalanche_saves_interest():
    debts = [debt("grande", 1000, 5, 50), debt("chica", 200, 1, 20)]
    snowball = simulate(debts, budget=300, strategy="snowball")
    avalanche = simulate(debts, budget=300, strategy="avalanche")

    assert snowball.payoffs[0].key == "chica"
    assert snowball.payoffs[0].month == 1
    assert avalanche.payoffs[0].key == "grande"
    assert avalanche.total_interest < snowball.total_interest


def test_freed_minimum_rolls_over_to_the_next_debt():
    # Con 'chica' pagada, su mínimo pasa a 'grande': el plan termina antes que pagar solo los mínimos.
    debts = [debt("grande", 1000, 2, 100), debt("chica", 100, 2, 100)]
    plan = simulate(debts, budget=200, strategy="snowball")
    minimums = simulate(debts, budget=200, strategy=None)
    assert plan.months < minimums.months


def test_budget_below_the_minimums_is_not_enough():
    result = simulate([debt("a", 1000, 2, 100), debt("b", 500, 2, 80)], budget=150, strategy="avalanche")
    assert result.status == "insufficient_budget"
    assert result.months is None


def test_minimum_that_does_not_cover_interest_never_ends():
    result = simulate([debt("a", 100_000, 3, 2_000)], budget=0, strategy=None)  # interés: 3.000 al mes
    assert result.status == "never"
    assert result.months is None


def test_no_debts_means_already_free():
    assert simulate([], budget=100, strategy="avalanche").months == 0


# --- API ---


def card(api, balance=-500_000, **extra):
    account = api.account("Tarjeta", type="credit_card", balance=balance, credit_limit=1_000_000, **extra)
    return account


def test_debt_crud_and_payments(api):
    created = api.post(
        "/debts",
        {"name": "Crédito de consumo", "kind": "consumer_loan", "balance": 300_000, "interest_rate": 1.5, "minimum_payment": 30_000},
    )
    assert created.status_code == 201, created.text
    debt_id = created.json()["id"]

    paid = api.post(f"/debts/{debt_id}/payments", {"amount": 50_000})
    assert paid.json()["balance"] == 250_000
    # Un pago mayor al saldo deja la deuda en 0, no negativa.
    assert api.post(f"/debts/{debt_id}/payments", {"amount": 999_999}).json()["balance"] == 0

    assert api.patch(f"/debts/{debt_id}", {"balance": 100_000}).json()["balance"] == 100_000
    assert [d["id"] for d in api.get("/debts").json()] == [debt_id]
    assert api.delete(f"/debts/{debt_id}").status_code == 204
    assert api.get("/debts").json() == []


def test_rate_typed_as_annual_is_rejected(api):
    resp = api.post(
        "/debts", {"name": "Crédito", "kind": "consumer_loan", "balance": 100_000, "interest_rate": 36, "minimum_payment": 10_000}
    )
    assert resp.status_code == 422


def test_card_rate_fields_are_only_kept_for_credit_cards(api):
    created = card(api, interest_rate=2.5, minimum_payment=25_000)
    assert created["interest_rate"] == 2.5
    assert created["minimum_payment"] == 25_000
    bank = api.account("Cuenta", type="bank", interest_rate=2.5, minimum_payment=25_000)
    assert bank["interest_rate"] is None and bank["minimum_payment"] is None


def test_plan_combines_cards_and_debts(api):
    complete = card(api, balance=-500_000, interest_rate=3, minimum_payment=25_000)
    incomplete = card(api, balance=-100_000)
    card(api, balance=0, interest_rate=3, minimum_payment=25_000)  # sin deuda: no aparece
    api.post("/debts", {"name": "Préstamo", "kind": "personal", "balance": 200_000, "interest_rate": 0, "minimum_payment": 20_000})

    plan = api.get("/debts/plan").json()
    keys = {d["key"]: d for d in plan["debts"]}
    assert set(keys) == {f"card-{complete['id']}", f"card-{incomplete['id']}", "debt-1"}
    assert keys[f"card-{incomplete['id']}"]["included"] is False
    assert plan["total_balance"] == 800_000
    assert plan["total_minimum"] == 45_000  # la tarjeta incompleta no suma
    assert plan["monthly_interest"] == 15_000  # 3% de 500.000
    # Sin presupuesto guardado se usa la suma de los mínimos.
    assert plan["monthly_budget"] == 45_000
    assert plan["budget_is_saved"] is False

    faster = api.get("/debts/plan", params={"budget": 150_000}).json()
    assert faster["avalanche"]["status"] == "ok"
    assert faster["avalanche"]["months"] < plan["avalanche"]["months"]
    assert faster["avalanche"]["total_interest"] < faster["minimum_only"]["total_interest"]


def test_plan_settings_are_saved(api):
    api.post("/debts", {"name": "Avance", "kind": "cash_advance", "balance": 100_000, "interest_rate": 2, "minimum_payment": 10_000})
    assert api.put("/debts/plan-settings", {"monthly_budget": 40_000, "strategy": "snowball"}).status_code == 200
    plan = api.get("/debts/plan").json()
    assert plan["monthly_budget"] == 40_000
    assert plan["budget_is_saved"] is True
    assert plan["strategy"] == "snowball"


def test_debts_are_private(client, api, make_user):
    created = api.post("/debts", {"name": "Mía", "kind": "other", "balance": 1000, "interest_rate": 0, "minimum_payment": 100}).json()
    other = make_user("otra@example.com")
    assert client.get("/api/v1/debts", headers=other).json() == []
    assert client.patch(f"/api/v1/debts/{created['id']}", headers=other, json={"balance": 0}).status_code == 404
    assert client.post(f"/api/v1/debts/{created['id']}/payments", headers=other, json={"amount": 1}).status_code == 404
    assert client.get("/api/v1/debts/plan", headers=other).json()["debts"] == []
