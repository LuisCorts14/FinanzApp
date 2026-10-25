def test_expenses_by_category_converts_to_clp(api):
    clp = api.account("RUT")
    usd = api.account("Dólares", currency="USD")
    food = api.category("Comida")
    travel = api.category("Viajes")
    api.transaction(clp["id"], food["id"], 20000)
    api.transaction(clp["id"], food["id"], 5000)
    api.transaction(usd["id"], travel["id"], 100)  # 100 USD = 95.000 CLP

    totals = {c["category_name"]: c["total"] for c in api.get("/stats/expenses-by-category", params={"month": "2026-10"}).json()}
    assert totals == {"Viajes": 95000, "Comida": 25000}


def test_monthly_summary_groups_income_and_expense_by_month(api):
    account = api.account()
    food = api.category("Comida")
    salary = api.category("Sueldo", "income")
    api.transaction(account["id"], salary["id"], 800000, date="2026-09-05")
    api.transaction(account["id"], food["id"], 100000, date="2026-09-10")
    api.transaction(account["id"], food["id"], 50000, date="2026-10-02")

    summary = api.get("/stats/monthly-summary").json()
    assert summary == [
        {"month": "2026-09", "income": 800000, "expense": 100000},
        {"month": "2026-10", "income": 0, "expense": 50000},
    ]


def test_weekly_summary_puts_the_last_days_in_week_four(api):
    account = api.account()
    food = api.category()
    for day, amount in [("01", 100), ("07", 200), ("08", 300), ("22", 400), ("31", 500)]:
        api.transaction(account["id"], food["id"], amount, date=f"2026-10-{day}")

    weeks = api.get("/stats/weekly-summary", params={"month": "2026-10"}).json()
    assert [w["expense"] for w in weeks] == [300, 300, 0, 900]
    assert weeks[3]["end_day"] == 31


def test_budget_status_reports_spending_for_the_month(api):
    account = api.account()
    food = api.category("Comida", monthly_budget=100000)
    api.category("Ropa")  # sin presupuesto: no aparece
    api.transaction(account["id"], food["id"], 80000, date="2026-10-03")
    api.transaction(account["id"], food["id"], 999999, date="2026-09-03")  # otro mes

    budgets = api.get("/stats/budgets", params={"month": "2026-10"}).json()
    assert budgets == [{"category_id": food["id"], "category_name": "Comida", "monthly_budget": 100000, "spent": 80000}]
