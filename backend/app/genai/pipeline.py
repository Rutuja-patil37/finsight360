"""
pipeline.py
------------
GenAI Orchestration Module - Pipeline / Orchestrator
Joint ownership: Madhura + Rutuja

This is the ONLY file backend/main.py should call into for the GenAI
module. It contains no business logic of its own - it just sequences
calls to the six module files, per entry point, so each of those files
can stay focused on one job and doesn't need to know the others exist.

THREE ENTRY POINTS (mirrors the three ways backend can trigger this module):
    handle_chat_request()             <- Advisor & Queries tab
    handle_plan_generation_request()  <- Plan Generation button
    handle_what_if_request()          <- What-If Simulator button/slider

Only handle_chat_request() goes through router.py's classifier. The other
two construct an IntentResult directly (entry_point tells us what they are).

PLACEHOLDER NOTE: context_builder.py, prompts.py, gemini_client.py,
guardrails.py, response_formatter.py are not yet available in this session.
Each call below is a clearly marked placeholder using the AGREED function
signatures - swap in the real imports once those files are shared, e.g.:
    from context_builder import build_context
    from prompts import build_prompt
    from gemini_client import get_completion
    from guardrails import validate_numbers
    from response_formatter import format_response
"""

from typing import Optional

try:
    from . import (
        context_builder,
        gemini_client,
        guardrails,
        prompts,
        response_formatter,
        router,
    )
    from .schemas import IntentResult, WhatIfScenarioType
except ImportError:
    import context_builder
    import gemini_client
    import guardrails
    import prompts
    import response_formatter
    import router
    from schemas import IntentResult, WhatIfScenarioType

MAX_VALIDATION_RETRIES = 1

# ---------------------------------------------------------------------------
# Module Delegators
# ---------------------------------------------------------------------------

def _build_context(intent_result: IntentResult, user_id: str, **kwargs):
    """Delegates to context_builder.py."""
    return context_builder.build_context(intent_result, user_id, **kwargs)


def _build_prompt(context_payload):
    """Delegates to prompts.py."""
    return prompts.build_prompt(context_payload)


def _get_completion(prompt: str) -> str:
    """Delegates to gemini_client.py's generate_response()."""
    return gemini_client.generate_response(prompt)


def _validate_numbers(llm_response: str, finance_engine_output, user_profile=None):
    """Delegates to guardrails.py's validate_numbers()."""
    return guardrails.validate_numbers(
        llm_response, finance_engine_output, user_profile=user_profile
    )


def _format_response(
    validated_response: str,
    context_payload,
    guardrail_result: dict
):
    """Format the validated Gemini response for backend/frontend use."""
    return response_formatter.format_response(
        validated_response,
        context_payload,
        guardrail_result,
    )


import re

def _clean_pdf_text(text: str) -> str:
    if not text:
        return ""
    # Strip unprintable PDF bullet symbols, Private Use Area chars, and unicode boxes
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\uf000-\uf8ff\u25a0-\u25ff]', ' • ', text)
    # Replace weird square box bullets with standard bullet
    text = re.sub(r'[\u25A0\u25A1\u25A2\u25A3\u25A4\u25A5\u25A6\u25A7\u25A8\u25A9\u25AA\u25AB\u25CF]', '• ', text)
    # Fix repeated bullet symbols
    text = re.sub(r'(•\s*){2,}', '• ', text)
    # Normalize spacing around bullets
    text = re.sub(r'\s*•\s*', '\n• ', text)
    # Clean up redundant spaces
    text = re.sub(r'[ \t]+', ' ', text)
    # Normalize double linebreaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _get_validated_completion(
    prompt: str, context_payload=None
) -> tuple[str, dict]:
    """
    Calls Gemini and validates the response via guardrails.py. If validation
    fails (guardrail_result["valid"] is False), retries by asking Gemini to
    correct itself using prompts.build_correction_prompt().
    """
    finance_engine_output = context_payload.finance_engine_output if context_payload else None
    user_profile = context_payload.user_profile if context_payload else None

    try:
        response_text = _get_completion(prompt)
    except Exception as e:
        print(f"[Pipeline] LLM call failed: {e}")
        # Smart Contextual Fallback if API key is unconfigured or call fails
        if context_payload and context_payload.rag_result and context_payload.rag_result.chunks:
            cleaned_chunks = []
            for c in context_payload.rag_result.chunks:
                if c.text:
                    cleaned_chunks.append(_clean_pdf_text(c.text))
            chunks_text = "\n\n".join(cleaned_chunks)
            if chunks_text.strip():
                fallback_text = chunks_text
            else:
                fallback_text = "Based on our financial knowledge base assessment, please review the retrieved guidelines below."
        elif context_payload and getattr(context_payload, "entry_point", None) == "plan_generation":
            fallback_text = (
                "Our core financial engine has computed three optimization plans based on your income, expenses, and goals. "
                "Plan A maintains your baseline savings. Plan B adjusts timeline targets for lower-priority goals. "
                "Plan C optimizes discretionary spending to maximize compounding wealth."
            )
        elif context_payload and getattr(context_payload, "entry_point", None) == "what_if_simulation":
            fallback_text = (
                "The What-If stress test simulation has been calculated by the core financial engine. "
                "Review the updated goal feasibility status and revised compounding trajectories above."
            )
        else:
            fallback_text = (
                "Based on the financial assessment, your goals have been evaluated "
                "against your cash flow and assets. Please review the detailed projections "
                "and plan comparisons."
            )
        return fallback_text, {"valid": True, "unverified_numbers": [], "suspiciously_thin": False}

    guardrail_result = _validate_numbers(response_text, finance_engine_output, user_profile=user_profile)

    attempts = 0
    while not guardrail_result["valid"] and attempts < MAX_VALIDATION_RETRIES:
        correction_prompt = prompts.build_correction_prompt(
            original_prompt=prompt,
            llm_response=response_text,
            guardrail_result=guardrail_result,
        )
        try:
            retry_text = _get_completion(correction_prompt)
            retry_guardrail = _validate_numbers(
                retry_text, finance_engine_output, user_profile=user_profile
            )
            response_text = retry_text
            guardrail_result = retry_guardrail
        except Exception as e:
            print(f"[Pipeline] Retry failed: {e}")
            break
        attempts += 1

    return response_text, guardrail_result


# ---------------------------------------------------------------------------
# Entry Point 1: Chat message (Advisor & Queries tab)
# ---------------------------------------------------------------------------

def handle_chat_request(
    user_id: str,
    query: str,
    plan_id: Optional[str] = None,
    plan_data=None,
    chat_history: Optional[list] = None,
):
    intent_result = router.classify_intent(query, plan_id=plan_id)

    # Short-circuit: plan-referential query with no plan_id.
    if intent_result.needs_plan_clarification:
        return {
            "type": "clarification",
            "message": (
                "Which plan are you asking about \u2014 Plan A, Plan B, or "
                "Plan C? Let me know and I'll take another look."
            ),
        }

    context_payload = _build_context(
        intent_result, user_id=user_id, plan_data=plan_data, chat_history=chat_history
    )
    prompt = _build_prompt(context_payload)
    validated_response, guardrail_result = _get_validated_completion(prompt, context_payload)
    return _format_response(validated_response, context_payload, guardrail_result)


# ---------------------------------------------------------------------------
# Entry Point 2: Plan Generation (button)
# ---------------------------------------------------------------------------

def handle_plan_generation_request(user_id: str):
    intent_result = IntentResult(
        entry_point="plan_generation",
        plan_id=None,
    )

    context_payload = _build_context(intent_result, user_id=user_id)
    prompt = _build_prompt(context_payload)
    validated_response, guardrail_result = _get_validated_completion(prompt, context_payload)
    res = _format_response(validated_response, context_payload, guardrail_result)
    if context_payload.finance_engine_output:
        res["finance_engine_output"] = context_payload.finance_engine_output.model_dump()
    return res


# ---------------------------------------------------------------------------
# Entry Point 3: What-If Simulation (button/slider)
# ---------------------------------------------------------------------------

def handle_what_if_request(
    user_id: str,
    scenario_type: WhatIfScenarioType,
    scenario_params: dict = None,
):
    intent_result = IntentResult(
        entry_point="what_if_simulation",
        plan_id=None,
    )

    context_payload = _build_context(
        intent_result,
        user_id=user_id,
        scenario_type=scenario_type,
        scenario_params=scenario_params or {},
    )
    prompt = _build_prompt(context_payload)
    validated_response, guardrail_result = _get_validated_completion(prompt, context_payload)
    return _format_response(validated_response, context_payload, guardrail_result)