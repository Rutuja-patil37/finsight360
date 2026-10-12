# backend/app/core/config.py

class EngineConfig:
    """Fixed assumptions the engine uses unless overridden."""

    DEFAULT_INFLATION_RATE = 0.06        # 6%
    DEFAULT_RETURN_RATE = 0.10           # 10% (fallback if Yahoo Finance fails)
    EMERGENCY_FUND_MONTHS = 6
    PLAN_B_DELAY_YEARS = 2
    PLAN_C_EXPENSE_CUT_PERCENT = 0.20    # 20%
    FEASIBILITY_TOLERANCE = 0.95         # 95%+ funded = feasible