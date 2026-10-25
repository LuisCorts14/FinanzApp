import enum


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK = "bank"
    CREDIT_CARD = "credit_card"
    SAVINGS = "savings"


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
