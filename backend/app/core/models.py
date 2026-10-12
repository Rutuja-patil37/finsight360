# backend/app/core/models.py

from pydantic import BaseModel
from typing import Optional


class Goal(BaseModel):
    name: str
    target_amount: float
    target_year: int          # e.g. 5 (years from now)
    priority: str              # "High" / "Medium" / "Low"


class UserData(BaseModel):
    income: float               # monthly income
    expenses: float              # monthly expenses
    savings: float                # current total savings/investments
    goals: list[Goal]


class FeasibilityResult(BaseModel):
    goal_name: str
    feasible: bool
    projected_amount: float
    funding_gap: float
    years_to_goal: int


class ConflictResult(BaseModel):
    conflicting: bool
    details: str


class EngineOutput(BaseModel):
    summary: dict
    projections: dict
    feasibility: list[FeasibilityResult]
    conflicts: ConflictResult
    plans: dict