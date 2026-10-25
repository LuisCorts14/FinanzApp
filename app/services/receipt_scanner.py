"""Lectura de boletas con Claude (visión + salida estructurada).

Recibe la foto de una boleta y las categorías de gasto del usuario, y devuelve comercio, fecha,
total e ítems, cada uno asignado a una de esas categorías (o a ninguna). La foto no se guarda.
"""

import base64
import json
from datetime import date

import anthropic
from pydantic import BaseModel, ValidationError

from app.core.config import settings

SUPPORTED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class ReceiptScanError(Exception):
    """La boleta no se pudo leer (foto ilegible, no es una boleta, respuesta inválida)."""


class ReceiptServiceUnavailable(Exception):
    """El servicio de IA no está configurado o no respondió."""


class ExtractedItem(BaseModel):
    description: str
    amount: float
    category_id: int | None


class ReceiptExtraction(BaseModel):
    is_receipt: bool
    merchant: str | None
    date: str | None
    currency: str
    total: float | None
    items: list[ExtractedItem]


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


RECEIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_receipt": {"type": "boolean"},
        "merchant": _nullable({"type": "string"}),
        "date": _nullable({"type": "string"}),
        "currency": {"type": "string"},
        "total": _nullable({"type": "number"}),
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "amount": {"type": "number"},
                    "category_id": _nullable({"type": "integer"}),
                },
                "required": ["description", "amount", "category_id"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["is_receipt", "merchant", "date", "currency", "total", "items"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """Lees fotos de boletas, facturas y comprobantes de compra, mayoritariamente de Chile, para una app de finanzas personales. Extrae los datos tal como aparecen impresos; la persona revisará y confirmará todo antes de guardarlo.

Reglas:
- is_receipt: false si la imagen no es un comprobante de compra o es ilegible; en ese caso deja items vacío y los demás campos en null.
- merchant: nombre comercial del local (p. ej. "Lider", "Farmacias Ahumada"), no la razón social completa si hay un nombre más reconocible.
- date: fecha de la compra en formato YYYY-MM-DD. Las boletas chilenas usan día/mes/año.
- currency: código ISO de la moneda; "CLP" si los montos son pesos chilenos.
- Montos: en pesos chilenos el punto separa miles ("$1.990" es 1990). Usa el precio final de cada línea (cantidad × precio unitario ya multiplicado).
- total: el TOTAL impreso en la boleta.
- items: una entrada por producto o servicio con su descripción corta y legible. Los descuentos van como ítems con monto negativo. No incluyas subtotales, IVA, vuelto, medios de pago ni el total como ítems.
- category_id: el id de la categoría de la persona que mejor describe ese ítem, elegido solo de la lista entregada. Usa null si ninguna calza razonablemente; no inventes ids."""


def _categories_text(categories: list[tuple[int, str]]) -> str:
    if not categories:
        return "La persona no tiene categorías de gasto: usa null en todos los category_id."
    lines = "\n".join(f"- id {cid}: {name}" for cid, name in categories)
    return f"Categorías de gasto de la persona:\n{lines}"


def extract_receipt(image: bytes, media_type: str, categories: list[tuple[int, str]]) -> ReceiptExtraction:
    if not settings.ANTHROPIC_API_KEY:
        raise ReceiptServiceUnavailable("El escaneo de boletas no está configurado en este servidor.")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=90.0)
    try:
        response = client.beta.messages.create(
            model=settings.RECEIPT_MODEL,
            max_tokens=16000,
            # Si un clasificador de seguridad declinara la solicitud, se reintenta en el modelo recomendado.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": RECEIPT_SCHEMA},
            },
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64.standard_b64encode(image).decode("ascii"),
                            },
                        },
                        {"type": "text", "text": f"{_categories_text(categories)}\n\nExtrae los datos de esta boleta."},
                    ],
                }
            ],
        )
    except anthropic.RateLimitError as e:
        raise ReceiptServiceUnavailable("El servicio de lectura está ocupado. Intenta en un momento.") from e
    except anthropic.BadRequestError as e:
        raise ReceiptScanError("No se pudo procesar la imagen. Prueba con otra foto.") from e
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        raise ReceiptServiceUnavailable("El servicio de lectura no respondió. Intenta de nuevo.") from e

    if response.stop_reason == "refusal":
        raise ReceiptScanError("No se pudo leer esta imagen. Prueba con una foto de la boleta.")
    if response.stop_reason == "max_tokens":
        raise ReceiptScanError("La boleta es demasiado larga para leerla de una vez.")

    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return ReceiptExtraction.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as e:
        raise ReceiptScanError("La lectura de la boleta vino incompleta. Intenta de nuevo.") from e


def parse_receipt_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
