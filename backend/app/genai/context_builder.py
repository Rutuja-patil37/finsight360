"""
context_builder.py
--------------------
GenAI Orchestration Module - Context Builder
Owner: Madhura

Purpose: Given an IntentResult, decides which of RAG / Finance Engine
(both black boxes) need to be called, calls them, and assembles everything
into a ContextPayload ready for prompts.py.

DECISION ORDER (important - entry_point is checked BEFORE intent):
    1. entry_point == "plan_generation"    -> ALWAYS fetch both Finance
                                               Engine (normal case) + RAG.
    2. entry_point == "what_if_simulation" -> ALWAYS fetch both Finance
                                               Engine (what-if case) + RAG.
    3. entry_point == "chat"               -> fetch based on `intent`:
           KNOWLEDGE_QUERY    -> RAG only
           FEASIBILITY_CHECK  -> Finance Engine only
           PLAN_EXPLANATION   -> Finance Engine + RAG
           GENERAL_CHAT       -> neither
           WHAT_IF            -> RAG only + needs_whatif_nudge=True
       EXCEPTION: if is_low_confidence is True, fetch BOTH regardless of
       the intent's normal mapping (see router.py for why).

PLAN-SCOPED CHAT QUERIES: when plan_data is provided (backend already
fetched it from DB for the given plan_id), it's used directly as the
finance_engine_output - the Finance Engine is NOT called again. When
plan_id is None but Finance Engine data is needed, the base/normal-case
data for the user's current profile is fetched instead.

TEMPORARY INTEGRATION NOTES:
- `_get_user_profile()` is a placeholder for mock_user.py (signature
  unconfirmed - assumed get_user_profile(user_id) -> UserProfile).
- `_call_finance_normal()` / `_call_finance_whatif()` are placeholders for
  mock_finance.py's get_normal_plan_output() / get_what_if_output().
- `_call_rag()` is a placeholder for mock_rag.py (signature unconfirmed).
Swap each in once the real mock/real files are available - the logic in
build_context() itself does not need to change, just these three helpers.
"""

from typing import Optional

try:
    from .schemas import (
        ContextPayload,
        IntentResult,
        IntentType,
        WhatIfScenarioType,
    )
except ImportError:
    from schemas import (
        ContextPayload,
        IntentResult,
        IntentType,
        WhatIfScenarioType,
    )


# ---------------------------------------------------------------------------
# Synthetic RAG queries for entry points with no natural-language query
# ---------------------------------------------------------------------------

GENERIC_PLAN_GEN_RAG_QUERY = (
    "savings goal prioritization and conflict resolution guidelines"
)

SCENARIO_RAG_QUERIES = {
    WhatIfScenarioType.JOB_LOSS: "emergency fund and job loss financial guidelines",
    WhatIfScenarioType.MARKET_CRASH: "market volatility and investment risk guidelines",
    WhatIfScenarioType.SALARY_HIKE: "increased income savings allocation guidelines",
}


# ---------------------------------------------------------------------------
# Data Connectors (wired to mocks for testing; swap to real modules when ready)
# ---------------------------------------------------------------------------

def _get_user_profile(user_id: str):
    """Fetches user profile from Database."""
    from app.database.db import get_profile_by_email, get_goals_by_email, get_user_by_email
    from app.genai.schemas import UserProfile, Goal as GenAIGoal, RiskAppetite, GoalPriority

    prof_row = get_profile_by_email(user_id)
    goals_rows = get_goals_by_email(user_id)
    user_row = get_user_by_email(user_id)
    name = user_row["name"] if user_row else "User"

    if not prof_row:
        # Fallback default profile
        return UserProfile(
            user_id=user_id,
            name=name,
            age=0,
            monthly_net_income=0.0,
            monthly_expenses=0.0,
            current_assets=0.0,
            expected_return_rate=12.0,
            base_inflation_rate=6.0,
            risk_appetite=RiskAppetite.MEDIUM,
            goals=[]
        )

    goals = []
    for g in goals_rows:
        p_val = g["priority"].lower()
        if p_val == "high":
            priority = GoalPriority.HIGH
        elif p_val == "low":
            priority = GoalPriority.LOW
        else:
            priority = GoalPriority.MEDIUM
        goals.append(GenAIGoal(
            description=g["name"],
            target_amount=float(g["target_amount"]),
            target_year=int(g["target_year"]),
            priority=priority
        ))

    risk_val = prof_row["risk_tolerance"].lower()
    if risk_val == "high":
        risk_appetite = RiskAppetite.HIGH
    elif risk_val == "low":
        risk_appetite = RiskAppetite.LOW
    else:
        risk_appetite = RiskAppetite.MEDIUM

    return UserProfile(
        user_id=user_id,
        name=name,
        age=int(prof_row["age"]),
        monthly_net_income=float(prof_row["monthly_income"]),
        monthly_expenses=float(prof_row["monthly_expense"]),
        current_assets=float(prof_row["current_savings"]),
        expected_return_rate=float(prof_row.get("expected_return", 12.0)),
        base_inflation_rate=float(prof_row.get("base_inflation", 6.0)),
        risk_appetite=risk_appetite,
        goals=goals
    )


def _call_finance_normal(user_id: str):
    """Fetches normal plan calculation from real FinancialEngine."""
    from app.core.models import UserData, Goal as CoreGoal
    from app.core.engine import FinancialEngine
    from app.genai.schemas import NormalCaseOutput

    user_profile = _get_user_profile(user_id)

    engine_input = UserData(
        income=float(user_profile.monthly_net_income),
        expenses=float(user_profile.monthly_expenses),
        savings=float(user_profile.current_assets),
        goals=[
            CoreGoal(
                name=g.description,
                target_amount=float(g.target_amount),
                target_year=int(g.target_year),
                priority=g.priority.value if hasattr(g.priority, "value") else str(g.priority)
            )
            for g in user_profile.goals
        ]
    )

    engine = FinancialEngine(engine_input)
    res = engine.run_full_pipeline()
    return NormalCaseOutput.model_validate(res)


def _call_finance_whatif(user_id: str, scenario_type, scenario_params: dict = None):
    """Fetches what-if simulation from real FinancialEngine simulator."""
    from app.core.models import UserData, Goal as CoreGoal
    from app.core.engine import FinancialEngine
    from app.genai.schemas import WhatIfCaseOutput

    user_profile = _get_user_profile(user_id)
    params = scenario_params or {}

    engine_input = UserData(
        income=float(user_profile.monthly_net_income),
        expenses=float(user_profile.monthly_expenses),
        savings=float(user_profile.current_assets),
        goals=[
            CoreGoal(
                name=g.description,
                target_amount=float(g.target_amount),
                target_year=int(g.target_year),
                priority=g.priority.value if hasattr(g.priority, "value") else str(g.priority)
            )
            for g in user_profile.goals
        ]
    )

    engine = FinancialEngine(engine_input)
    scenario_str = scenario_type.value if hasattr(scenario_type, "value") else str(scenario_type)

    res = engine.simulate(
        scenario=scenario_str,
        months_affected=params.get("months_affected", 6),
        crash_rate=params.get("crash_rate", -0.20),
        include_plans=True
    )
    return WhatIfCaseOutput.model_validate(res)


def _call_rag(query: str):
    """Fetches RAG chunks from real RAG retriever."""
    from app.rag.rag import retrieve_context
    from app.genai.schemas import RAGResult, RAGChunk

    chunks_raw = retrieve_context(query, top_k=3)
    chunks = [
        RAGChunk(
            source=c["source"],
            page=c.get("page", 0),
            text=c["text"],
            distance=c.get("distance", 0.0)
        )
        for c in chunks_raw
    ]
    return RAGResult(query=query, chunks=chunks)


# ---------------------------------------------------------------------------
# Fetch-decision logic for the "chat" entry point
# ---------------------------------------------------------------------------

def _should_fetch_for_chat_intent(intent: IntentType) -> tuple[bool, bool, bool]:
    """
    Returns (fetch_rag, fetch_finance, needs_whatif_nudge) for a given
    chat intent, per the mapping documented in the module docstring.
    """
    if intent == IntentType.KNOWLEDGE_QUERY:
        return True, False, False
    if intent == IntentType.FEASIBILITY_CHECK:
        return False, True, False
    if intent == IntentType.PLAN_EXPLANATION:
        return True, True, False
    if intent == IntentType.GENERAL_CHAT:
        return False, False, False
    if intent == IntentType.WHAT_IF:
        return True, False, True

    # Should never happen given IntentType is an enum, but fail loudly
    # rather than silently fetching nothing if a new intent gets added
    # later without updating this function.
    raise ValueError(f"Unhandled intent type in context_builder.py: {intent}")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_context(
    intent_result: IntentResult,
    user_id: str,
    plan_data=None,
    chat_history: Optional[list] = None,
    scenario_type: Optional[WhatIfScenarioType] = None,
    scenario_params: Optional[dict] = None,
) -> ContextPayload:
    """
    Assembles a ContextPayload for prompts.py, given the classified/
    constructed IntentResult and whatever entry-point-specific extras
    pipeline.py passed along.

    Args:
        intent_result: from router.py (chat) or constructed directly in
                        pipeline.py (plan_generation / what_if_simulation).
        user_id: the user's id.
        plan_data: FULL Finance Engine output already fetched by backend
                   for the selected plan (chat entry point only, when
                   plan_id was given). Used directly instead of re-calling
                   the Finance Engine.
        chat_history: last N messages (chat entry point only).
        scenario_type / scenario_params: required for what_if_simulation,
                                          ignored otherwise.

    Returns:
        ContextPayload
    """
    user_profile = _get_user_profile(user_id)

    finance_engine_output = None
    rag_result = None
    needs_whatif_nudge = False

    if intent_result.entry_point == "plan_generation":
        finance_engine_output = _call_finance_normal(user_id)
        rag_result = _call_rag(GENERIC_PLAN_GEN_RAG_QUERY)

    elif intent_result.entry_point == "what_if_simulation":
        finance_engine_output = _call_finance_whatif(user_id, scenario_type, scenario_params)
        rag_result = _call_rag(SCENARIO_RAG_QUERIES[scenario_type])

    elif intent_result.entry_point == "chat":
        fetch_rag, fetch_finance, needs_whatif_nudge = _should_fetch_for_chat_intent(
            intent_result.intent
        )

        # Low confidence overrides the normal mapping - fetch both to
        # maximize available context (see router.py for reasoning).
        if intent_result.is_low_confidence:
            fetch_rag = True
            fetch_finance = True

        if fetch_finance:
            if plan_data is not None:
                # Backend already fetched this from the DB for the
                # selected plan - don't call the Finance Engine again.
                finance_engine_output = plan_data
            else:
                # No specific plan selected - use the user's current
                # base-profile numbers.
                finance_engine_output = _call_finance_normal(user_id)

        if fetch_rag:
            rag_result = _call_rag(intent_result.raw_query)

    else:
        raise ValueError(f"Unhandled entry_point in context_builder.py: {intent_result.entry_point}")

    return ContextPayload(
        entry_point=intent_result.entry_point,
        user_query=intent_result.raw_query,
        intent=intent_result.intent,
        plan_id=intent_result.plan_id,
        is_low_confidence=intent_result.is_low_confidence,
        needs_whatif_nudge=needs_whatif_nudge,
        chat_history=chat_history,
        user_profile=user_profile,
        finance_engine_output=finance_engine_output,
        rag_result=rag_result,
    )