from datetime import date


def month_range(month: str) -> tuple[date, date]:
    """Parses 'YYYY-MM' and returns (first_day_of_month, first_day_of_next_month)."""
    year_str, month_str = month.split("-")
    year, mon = int(year_str), int(month_str)
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end
