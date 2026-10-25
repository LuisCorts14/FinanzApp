import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import receipt_scanner
from app.services.receipt_scanner import ExtractedItem, ReceiptExtraction, ReceiptScanError

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


@pytest.fixture
def scanner_enabled(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")


@pytest.fixture
def fake_extraction(monkeypatch):
    """Reemplaza la llamada a Claude en el endpoint y guarda con qué categorías se llamó."""
    calls = []

    def install(result):
        def fake(image, media_type, categories):
            calls.append({"media_type": media_type, "categories": categories})
            if isinstance(result, Exception):
                raise result
            return result

        monkeypatch.setattr("app.api.v1.endpoints.receipts.extract_receipt", fake)
        return calls

    return install


def scan(api, content=PNG, content_type="image/png"):
    return api.post("/receipts/scan", files={"image": ("boleta.png", content, content_type)})


def test_scan_groups_items_by_the_users_categories(api, scanner_enabled, fake_extraction):
    food = api.category("Comida")
    home = api.category("Hogar")
    api.category("Sueldo", "income")
    calls = fake_extraction(
        ReceiptExtraction(
            is_receipt=True,
            merchant="Lider",
            date="2026-10-18",
            currency="CLP",
            total=12470,
            items=[
                ExtractedItem(description="Leche", amount=1290, category_id=food["id"]),
                ExtractedItem(description="Pan", amount=1990, category_id=food["id"]),
                ExtractedItem(description="Detergente", amount=8990, category_id=home["id"]),
                ExtractedItem(description="Bolsa", amount=200, category_id=None),
            ],
        )
    )

    resp = scan(api)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["merchant"] == "Lider" and body["date"] == "2026-10-18"
    assert body["groups"] == [
        {"category_id": home["id"], "amount": 8990, "item_count": 1},
        {"category_id": food["id"], "amount": 3280, "item_count": 2},
        {"category_id": None, "amount": 200, "item_count": 1},
    ]
    assert body["items_total"] == 12470
    # Al modelo solo se le ofrecen las categorías de gasto de esta persona.
    assert sorted(name for _, name in calls[0]["categories"]) == ["Comida", "Hogar"]


def test_category_ids_that_are_not_the_users_are_dropped(client, api, make_user, scanner_enabled, fake_extraction):
    other = make_user("otro@example.com")
    foreign = client.post("/api/v1/categories", headers=other, json={"name": "Ajena", "type": "expense"}).json()
    fake_extraction(
        ReceiptExtraction(
            is_receipt=True,
            merchant="X",
            date="no-es-fecha",
            currency="clp",
            total=1000,
            items=[ExtractedItem(description="Algo", amount=1000, category_id=foreign["id"])],
        )
    )

    body = scan(api).json()
    assert body["items"][0]["category_id"] is None
    assert body["date"] is None
    assert body["currency"] == "CLP"


def test_rejects_unsupported_files_and_empty_images(api, scanner_enabled, fake_extraction):
    fake_extraction(ReceiptExtraction(is_receipt=True, merchant=None, date=None, currency="CLP", total=None, items=[]))
    assert scan(api, content=b"%PDF-1.4", content_type="application/pdf").status_code == 415
    assert scan(api, content=b"").status_code == 422


def test_not_a_receipt_returns_a_friendly_error(api, scanner_enabled, fake_extraction):
    fake_extraction(ReceiptExtraction(is_receipt=False, merchant=None, date=None, currency="CLP", total=None, items=[]))
    resp = scan(api)
    assert resp.status_code == 422
    assert "boleta" in resp.json()["detail"]


def test_disabled_without_api_key(api, monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    assert api.get("/receipts/quota").json()["enabled"] is False
    assert scan(api).status_code == 503


def test_daily_limit(api, scanner_enabled, fake_extraction, monkeypatch):
    monkeypatch.setattr(settings, "RECEIPT_SCANS_PER_DAY", 2)
    fake_extraction(ReceiptScanError("ilegible"))

    # Los intentos fallidos también cuentan: la llamada al modelo tiene costo igual.
    assert scan(api).status_code == 422
    assert scan(api).status_code == 422
    resp = scan(api)
    assert resp.status_code == 429
    assert api.get("/receipts/quota").json() == {"enabled": True, "limit": 2, "used": 2, "remaining": 0}


def test_quota_is_per_user(client, api, make_user, scanner_enabled, fake_extraction, monkeypatch):
    monkeypatch.setattr(settings, "RECEIPT_SCANS_PER_DAY", 1)
    fake_extraction(ReceiptScanError("ilegible"))
    scan(api)
    other = make_user("otro@example.com")
    assert client.get("/api/v1/receipts/quota", headers=other).json()["remaining"] == 1


# --- El servicio que habla con Claude, con un cliente falso (sin llamadas reales) ---


class FakeMessages:
    def __init__(self, response):
        self.response = response
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        return self.response


def install_fake_client(monkeypatch, response):
    messages = FakeMessages(response)
    fake_client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    monkeypatch.setattr(receipt_scanner.anthropic, "Anthropic", lambda **kw: fake_client)
    return messages


def claude_response(payload, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=json.dumps(payload))]
    )


def test_service_builds_the_request_and_parses_the_json(monkeypatch, scanner_enabled):
    payload = {
        "is_receipt": True,
        "merchant": "Jumbo",
        "date": "2026-10-01",
        "currency": "CLP",
        "total": 5000,
        "items": [{"description": "Queso", "amount": 5000, "category_id": 3}],
    }
    messages = install_fake_client(monkeypatch, claude_response(payload))

    result = receipt_scanner.extract_receipt(PNG, "image/png", [(3, "Comida")])
    assert result.merchant == "Jumbo" and result.items[0].category_id == 3

    sent = messages.kwargs
    assert sent["model"] == settings.RECEIPT_MODEL
    assert sent["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in sent["betas"]
    assert sent["output_config"]["format"]["type"] == "json_schema"
    image_block, text_block = sent["messages"][0]["content"]
    assert image_block["type"] == "image" and image_block["source"]["media_type"] == "image/png"
    assert "id 3: Comida" in text_block["text"]


def test_service_handles_refusals_and_bad_json(monkeypatch, scanner_enabled):
    install_fake_client(monkeypatch, claude_response({}, stop_reason="refusal"))
    with pytest.raises(ReceiptScanError):
        receipt_scanner.extract_receipt(PNG, "image/png", [])

    install_fake_client(monkeypatch, SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="{no json")]))
    with pytest.raises(ReceiptScanError):
        receipt_scanner.extract_receipt(PNG, "image/png", [])
