# backend/app/core/utils.py

def future_value(monthly_investment: float, annual_rate: float, years: int) -> float:
    """
    Future value of a monthly SIP-style investment.
    """
    monthly_rate = annual_rate / 12
    months = years * 12
    if monthly_rate == 0:
        return monthly_investment * months
    fv = monthly_investment * (((1 + monthly_rate) ** months - 1) / monthly_rate)
    return round(fv, 2)


def lumpsum_future_value(principal: float, annual_rate: float, years: int) -> float:
    """
    Future value of a one-time lumpsum investment.
    """
    return round(principal * ((1 + annual_rate) ** years), 2)


def inflation_adjust(amount: float, inflation_rate: float, years: int) -> float:
    """
    Adjusts a future amount to reflect what it will actually cost
    after 'years' of inflation.
    """
    return round(amount * ((1 + inflation_rate) ** years), 2)


def savings_rate(income: float, expenses: float) -> float:
    if income == 0:
        return 0.0
    return round((income - expenses) / income, 4)