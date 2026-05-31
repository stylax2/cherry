from datetime import date, timedelta


def doy_to_date(year: int, doy: float) -> str:
    rounded = max(1, int(round(doy)))
    return (date(year, 1, 1) + timedelta(days=rounded - 1)).isoformat()


def clamp_doy(doy: float, year: int) -> float:
    max_doy = 366 if _is_leap_year(year) else 365
    return min(max(1.0, doy), float(max_doy))


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
