"""Catálogo de instituciones financieras de Chile y los productos que ofrece cada una.

Es una lista mantenida a mano (no existe una API pública con esta información). Cada
producto declara a qué AccountType corresponde, para que balances y estadísticas sigan
funcionando igual sin importar la institución. Donde no hay certeza del nombre comercial
de un producto se usa un nombre genérico.
"""

from dataclasses import dataclass, field

from app.models.enums import AccountType


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    account_type: AccountType
    currency: str = "CLP"


@dataclass(frozen=True)
class Institution:
    id: str
    name: str
    group: str
    color: str
    products: list[Product] = field(default_factory=list)


GROUP_BANKS = "Bancos"
GROUP_WALLETS = "Billeteras y fintech"
GROUP_RETAIL = "Tarjetas de casas comerciales"
GROUP_COOPS = "Cooperativas"
GROUP_INVESTMENT = "Ahorro e inversión"

GROUPS = [GROUP_BANKS, GROUP_WALLETS, GROUP_RETAIL, GROUP_COOPS, GROUP_INVESTMENT]

_CHECKING = Product("cuenta_corriente", "Cuenta Corriente", AccountType.BANK)
_DEBIT = Product("cuenta_vista", "Cuenta Vista", AccountType.BANK)
_SAVINGS = Product("cuenta_ahorro", "Cuenta de Ahorro", AccountType.SAVINGS)
_CREDIT = Product("tarjeta_credito", "Tarjeta de Crédito", AccountType.CREDIT_CARD)
_USD = Product("cuenta_corriente_usd", "Cuenta Corriente en dólares", AccountType.BANK, "USD")

INSTITUTIONS: list[Institution] = [
    # Bancos
    Institution(
        "bancoestado",
        "BancoEstado",
        GROUP_BANKS,
        "#f29400",
        [Product("cuentarut", "CuentaRUT", AccountType.BANK), _CHECKING, _SAVINGS, _CREDIT],
    ),
    Institution(
        "banco_chile",
        "Banco de Chile",
        GROUP_BANKS,
        "#0b2d6b",
        [_CHECKING, Product("cuenta_fan", "Cuenta FAN", AccountType.BANK), _SAVINGS, _CREDIT, _USD],
    ),
    Institution(
        "santander",
        "Santander",
        GROUP_BANKS,
        "#e30613",
        [_CHECKING, Product("cuenta_life", "Cuenta Life", AccountType.BANK), _SAVINGS, _CREDIT, _USD],
    ),
    Institution("bci", "Bci", GROUP_BANKS, "#1d4f91", [_CHECKING, _SAVINGS, _CREDIT, _USD]),
    Institution("scotiabank", "Scotiabank", GROUP_BANKS, "#c8102e", [_CHECKING, _DEBIT, _SAVINGS, _CREDIT, _USD]),
    Institution("itau", "Itaú", GROUP_BANKS, "#ec7000", [_CHECKING, _DEBIT, _CREDIT, _USD]),
    Institution("bice", "Banco BICE", GROUP_BANKS, "#13294b", [_CHECKING, _CREDIT, _USD]),
    Institution("security", "Banco Security", GROUP_BANKS, "#5b2a86", [_CHECKING, _CREDIT, _USD]),
    Institution(
        "banco_falabella",
        "Banco Falabella",
        GROUP_BANKS,
        "#4a8f29",
        [_CHECKING, _DEBIT, Product("tarjeta_cmr", "Tarjeta CMR", AccountType.CREDIT_CARD)],
    ),
    Institution(
        "banco_ripley",
        "Banco Ripley",
        GROUP_BANKS,
        "#5f2e8c",
        [_DEBIT, Product("tarjeta_ripley", "Tarjeta Ripley", AccountType.CREDIT_CARD)],
    ),
    Institution("consorcio", "Banco Consorcio", GROUP_BANKS, "#00704a", [_CHECKING, _DEBIT, _CREDIT]),
    Institution("internacional", "Banco Internacional", GROUP_BANKS, "#003a70", [_CHECKING, _CREDIT]),
    # Billeteras y fintech
    Institution(
        "mach",
        "MACH",
        GROUP_WALLETS,
        "#6c2bd9",
        [Product("cuenta", "Cuenta MACH", AccountType.BANK), _CREDIT],
    ),
    Institution(
        "tenpo",
        "Tenpo",
        GROUP_WALLETS,
        "#00a99d",
        [Product("cuenta", "Cuenta Tenpo", AccountType.BANK), _CREDIT],
    ),
    Institution(
        "mercado_pago",
        "Mercado Pago",
        GROUP_WALLETS,
        "#009ee3",
        [Product("cuenta", "Cuenta Mercado Pago", AccountType.BANK), _CREDIT],
    ),
    Institution("tapp", "Tapp", GROUP_WALLETS, "#00a3e0", [Product("cuenta", "Cuenta Tapp", AccountType.BANK)]),
    # Tarjetas de casas comerciales
    Institution(
        "cencosud",
        "Cencosud Scotiabank",
        GROUP_RETAIL,
        "#0055a5",
        [Product("tarjeta_cencosud", "Tarjeta Cencosud", AccountType.CREDIT_CARD)],
    ),
    Institution(
        "lider_bci",
        "Lider Bci",
        GROUP_RETAIL,
        "#0071ce",
        [Product("tarjeta_lider", "Tarjeta Lider Bci", AccountType.CREDIT_CARD)],
    ),
    Institution(
        "la_polar",
        "La Polar",
        GROUP_RETAIL,
        "#d6001c",
        [Product("tarjeta_la_polar", "Tarjeta La Polar", AccountType.CREDIT_CARD)],
    ),
    Institution(
        "hites",
        "Hites",
        GROUP_RETAIL,
        "#e2231a",
        [Product("tarjeta_hites", "Tarjeta Hites", AccountType.CREDIT_CARD)],
    ),
    # Cooperativas
    Institution(
        "coopeuch",
        "Coopeuch",
        GROUP_COOPS,
        "#00843d",
        [_DEBIT, Product("libreta_ahorro", "Libreta de Ahorro", AccountType.SAVINGS), _CREDIT],
    ),
    # Ahorro e inversión
    Institution(
        "fintual",
        "Fintual",
        GROUP_INVESTMENT,
        "#1f2a44",
        [Product("inversion", "Fondos de inversión", AccountType.SAVINGS)],
    ),
]

_BY_ID: dict[str, Institution] = {inst.id: inst for inst in INSTITUTIONS}


def get_institution(institution_id: str) -> Institution | None:
    return _BY_ID.get(institution_id)


def get_product(institution_id: str, product_id: str) -> Product | None:
    institution = _BY_ID.get(institution_id)
    if institution is None:
        return None
    return next((p for p in institution.products if p.id == product_id), None)
