import time

import httpx

BASE_CURRENCY = "CLP"
_CACHE_TTL_SECONDS = 6 * 60 * 60

_rate_cache: dict[str, tuple[dict[str, float], float]] = {}


def _fetch_rates(base_currency: str) -> dict[str, float]:
    response = httpx.get(f"https://open.er-api.com/v6/latest/{base_currency}", timeout=10)
    response.raise_for_status()
    data = response.json()
    return data["rates"]


def get_exchange_rate(from_currency: str, to_currency: str = BASE_CURRENCY) -> float:
    """Returns how many units of to_currency equal 1 unit of from_currency.

    Falls back to stale cached rates (or 1.0 as a last resort) if the exchange
    rate API is unreachable, so a flaky third-party API never breaks the app.
    """
    if from_currency == to_currency:
        return 1.0

    now = time.time()
    cached = _rate_cache.get(from_currency)
    if cached and now - cached[1] < _CACHE_TTL_SECONDS:
        return cached[0].get(to_currency, 1.0)

    try:
        rates = _fetch_rates(from_currency)
        _rate_cache[from_currency] = (rates, now)
        return rates.get(to_currency, 1.0)
    except Exception:
        if cached:
            return cached[0].get(to_currency, 1.0)
        return 1.0
