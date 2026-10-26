import enum


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK = "bank"
    CREDIT_CARD = "credit_card"
    SAVINGS = "savings"


class DebtKind(str, enum.Enum):
    CONSUMER_LOAN = "consumer_loan"  # crédito de consumo
    CASH_ADVANCE = "cash_advance"  # avance en efectivo
    STORE_CREDIT = "store_credit"  # crédito de casa comercial
    PERSONAL = "personal"  # préstamo de un familiar o amigo
    OTHER = "other"


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
