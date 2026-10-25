def test_at_most_three_income_categories(api):
    for name in ("Sueldo", "Negocio", "Arriendo"):
        api.category(name, "income")
    resp = api.post("/categories", {"name": "Otro ingreso", "type": "income"})
    assert resp.status_code == 400

    # Los gastos no tienen límite.
    for i in range(5):
        api.category(f"Gasto {i}", "expense")


def test_duplicate_category_name_is_rejected(api):
    api.category("Comida")
    assert api.post("/categories", {"name": "Comida", "type": "expense"}).status_code == 409


def test_budget_is_only_kept_for_expense_categories(api):
    expense = api.category("Comida", "expense", monthly_budget=150000)
    income = api.category("Sueldo", "income", monthly_budget=150000)
    assert expense["monthly_budget"] == 150000
    assert income["monthly_budget"] is None


def test_category_in_use_cannot_be_deleted(api):
    account = api.account()
    food = api.category()
    api.transaction(account["id"], food["id"], 1000)

    assert api.delete(f"/categories/{food['id']}").status_code == 409
    unused = api.category("Viajes")
    assert api.delete(f"/categories/{unused['id']}").status_code == 204
