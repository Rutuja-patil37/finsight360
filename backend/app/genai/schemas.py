"""
schemas.py

Data contracts for the GenAI orchestration module (router.py,
context_builder.py, prompts.py).

Mocks in mocks/ must return instances of these classes. If any
upstream team (Backend/Profile, Finance Core, RAG) changes their
output format later, only this file and the corresponding mock
need to change -- router.py and context_builder.py depend solely
on these schemas, never on the upstream implementations.

CHANGE LOG (kept here so the reasoning isn't lost):
- Finance Engine schemas rewritten to match the real output sample
  (previous version was based on outdated placeholder shapes).
- IntentType/IntentResult merged: kept the original 5-category
  taxonomy (more specific routing than the 4-category version drafted
  mid-session) and added plan_id / is_low_confidence /
  needs_plan_clarification fields designed for the plan-selector-dropdown
  and low-confidence-footer behavior.
- WHAT_IF as a CHAT intent is intentionally narrow: it means "user asked
  a what-if question in free text" and should be treated like a knowledge
  query (RAG only) with a nudge toward the What-If Simulator tab -- it
  does NOT trigger the Finance Engine simulator. Only the dedicated
  What-If entry point (button/slider, bypasses router.py entirely) does that.
"""

from enum import Enum
from typing import Literal, Optional, Union
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

class IntentType(str, Enum):
    WHAT_IF = "what_if"                    # chat-typed what-if question -> RAG only + nudge to slider, NOT a simulation trigger
    FEASIBILITY_CHECK = "feasibility_check"  # "can I afford X" -> Finance Engine only
    PLAN_EXPLANATION = "plan_explanation"    # "why does plan B do X" -> Finance Engine + RAG
    KNOWLEDGE_QUERY = "knowledge_query"      # "what is an emergency fund" -> RAG only
    GENERAL_CHAT = "general_chat"            # greetings/small talk -> neither


class IntentResult(BaseModel):
    # Which of the three entry points produced this result. context_builder.py
    # must check this FIRST: plan_generation/what_if_simulation always fetch
    # both RAG + Finance Engine regardless of `intent` (which doesn't apply
    # to them). The `intent`-based fetch mapping only applies when
    # entry_point == "chat".
    entry_point: Literal["chat", "plan_generation", "what_if_simulation"]

    # Chat-only fields - None for plan_generation/what_if_simulation, since
    # those never go through router.py's classifier at all.
    intent: Optional[IntentType] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    raw_query: Optional[str] = None

    plan_id: Optional[str] = None
    # True when confidence < router.py's CONFIDENCE_THRESHOLD. When True,
    # context_builder.py should fetch BOTH RAG + Finance Engine regardless
    # of the labeled intent, to maximize available context. The guardrail
    # still protects against wrong numbers either way.
    is_low_confidence: bool = False
    # True when the query is plan-referential (mentions "this plan",
    # "plan B", etc.) but no plan_id was supplied. context_builder.py
    # should short-circuit on this and return a clarification question
    # instead of calling RAG/Finance Engine.
    needs_plan_clarification: bool = False


# ---------------------------------------------------------------------------
# User profile (confirmed against frontend screenshot; age + risk_appetite
# added explicitly by the frontend team, no derivation)
# ---------------------------------------------------------------------------

class RiskAppetite(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GoalPriority(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Goal(BaseModel):
    description: str
    target_amount: float
    target_year: int
    priority: GoalPriority


class UserProfile(BaseModel):
    user_id: str
    name: str
    age: int
    monthly_net_income: float
    monthly_expenses: float
    current_assets: float          # liquid reserves
    expected_return_rate: float    # % p.a., user-set
    base_inflation_rate: float     # % p.a., user-set
    risk_appetite: RiskAppetite
    goals: list[Goal] = Field(default_factory=list)

    @property
    def monthly_savings_margin(self) -> float:
        return self.monthly_net_income - self.monthly_expenses

    @property
    def savings_rate(self) -> float:
        if self.monthly_net_income == 0:
            return 0.0
        return self.monthly_savings_margin / self.monthly_net_income


# ---------------------------------------------------------------------------
# Finance Engine output -- shared building blocks
# ---------------------------------------------------------------------------

class FeasibilityResult(BaseModel):
    goal_name: str
    feasible: bool
    projected_amount: float
    funding_gap: float
    years_to_goal: float


class ConflictInfo(BaseModel):
    # Confirmed final as boolean-only (not per-goal-pair) -- do not expand
    # without re-confirming with the Finance Core team.
    conflicting: bool
    details: str


class PlanAOutput(BaseModel):
    description: str
    feasibility: list[FeasibilityResult]


class PlanBOutput(BaseModel):
    description: str
    delay_by_goal: dict[str, int]   # goal_name -> years delayed
    feasibility: list[FeasibilityResult]


class PlanCOutput(BaseModel):
    description: str
    cut_percent_calculated: float
    feasibility: list[FeasibilityResult]


class PlanSet(BaseModel):
    plan_a: PlanAOutput
    plan_b: PlanBOutput
    plan_c: PlanCOutput


# ---------------------------------------------------------------------------
# Finance Engine output -- NORMAL CASE (plan generation)
# ---------------------------------------------------------------------------

class EngineSummary(BaseModel):
    savings_rate: float
    monthly_surplus: float
    current_savings: float
    emergency_fund_months: float
    emergency_fund_status: str


class GoalProjection(BaseModel):
    projected_amount: float
    allocated_monthly_surplus: float
    allocated_savings: float
    return_rate_used: float


class NormalCaseOutput(BaseModel):
    summary: EngineSummary
    projections: dict[str, GoalProjection]   # keyed by goal_name
    feasibility: list[FeasibilityResult]
    conflicts: ConflictInfo
    plans: PlanSet


# ---------------------------------------------------------------------------
# Finance Engine output -- WHAT-IF CASE
# One shape shared by all scenario types (market_crash, job_loss,
# salary_hike) -- confirmed against real output samples for all three.
# ---------------------------------------------------------------------------

class WhatIfScenarioType(str, Enum):
    JOB_LOSS = "job_loss"
    MARKET_CRASH = "market_crash"
    SALARY_HIKE = "salary_hike"


class WhatIfCaseOutput(BaseModel):
    scenario: WhatIfScenarioType
    savings_after_shortfall: Optional[float] = None
    updated_feasibility: list[FeasibilityResult]
    conflicts: ConflictInfo
    plans: PlanSet


FinanceEngineOutput = Union[NormalCaseOutput, WhatIfCaseOutput]


# ---------------------------------------------------------------------------
# RAG output -- structured chunk list (per confirmed change request to
# the RAG team; replaces the pre-formatted string they were producing)
# ---------------------------------------------------------------------------

class RAGChunk(BaseModel):
    source: str
    page: int
    text: str
    distance: float


class RAGResult(BaseModel):
    query: str
    chunks: list[RAGChunk] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Assembled context sent to the LLM (built by context_builder.py)
# ---------------------------------------------------------------------------

class ContextPayload(BaseModel):
    entry_point: Literal["chat", "plan_generation", "what_if_simulation"]
    user_query: Optional[str] = None   # None for plan_generation/what_if_simulation
    intent: Optional[IntentType] = None
    plan_id: Optional[str] = None
    is_low_confidence: bool = False
    # True when the chat-typed WHAT_IF intent was used (free-text "what if
    # I lose my job" question) - tells response_formatter.py to append a
    # nudge pointing the user to the What-If Simulator tab. Never true for
    # the actual what_if_simulation entry point (that IS the simulator).
    needs_whatif_nudge: bool = False
    chat_history: Optional[list] = None
    user_profile: UserProfile
    finance_engine_output: Optional[FinanceEngineOutput] = None
    rag_result: Optional[RAGResult] = None