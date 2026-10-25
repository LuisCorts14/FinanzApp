from concurrent.futures import ThreadPoolExecutor

PARALLEL = 12


def test_parallel_transactions_do_not_lose_balance_updates(client, api, auth):
    account = api.account(balance=100000)
    food = api.category()

    def create(_):
        return client.post(
            "/api/v1/transactions",
            headers=auth,
            json={"account_id": account["id"], "category_id": food["id"], "amount": 1000, "date": "2026-10-15"},
        ).status_code

    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        statuses = list(pool.map(create, range(PARALLEL)))

    assert statuses == [201] * PARALLEL
    assert api.balance(account["id"]) == 100000 - 1000 * PARALLEL


def test_parallel_transfers_do_not_lose_balance_updates(client, api, auth):
    source = api.account("Origen", balance=100000)
    target = api.account("Destino")

    def transfer(_):
        return client.post(
            "/api/v1/transfers",
            headers=auth,
            json={"from_account_id": source["id"], "to_account_id": target["id"], "amount": 1000, "date": "2026-10-15"},
        ).status_code

    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        statuses = list(pool.map(transfer, range(PARALLEL)))

    assert statuses == [201] * PARALLEL
    assert api.balance(source["id"]) == 100000 - 1000 * PARALLEL
    assert api.balance(target["id"]) == 1000 * PARALLEL
