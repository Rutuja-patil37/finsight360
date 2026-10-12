"""
response_formatter.py
--------------------
GenAI Orchestration Module - Response Formatter

Converts Gemini's raw response into the frontend/backend-friendly
dictionary used by pipeline.py.

Gemini has different output styles depending on the entry point:

1. plan_generation
   -> JSON containing plan_a / plan_b / plan_c explanations.

2. what_if_simulation
   -> normal explanatory text.

3. chat
   -> normal explanatory text, except general_chat may also be plain text.

The formatter deliberately does NOT perform financial calculations or
change Finance Engine numbers. It only structures the LLM response and
adds orchestration metadata such as guardrail status and the What-If nudge.
"""

import json
from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_result() -> Dict[str, Any]:
    """Create the common response structure."""
    return {
        "type": "answer",
        "content": "",
        "insight": "",
        "recommendation": "",
        "next_steps": [],
        "plans": None,
        "sources": [],
        "guardrail": {
            "valid": True,
            "unverified_numbers": [],
            "suspiciously_thin": False,
        },
    }


def _clean_text(text: str) -> str:
    """Remove accidental markdown code fences around Gemini output."""
    text = (text or "").strip()

    if text.startswith("```") and text.endswith("```"):
        lines = text.splitlines()

        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    return text


def _parse_plan_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse Gemini's plan-generation JSON.

    Handles:
      {"plan_a": ..., "plan_b": ..., "plan_c": ...}

    and also JSON accidentally wrapped in markdown fences.
    """
    cleaned = _clean_text(text)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Be slightly tolerant if Gemini adds text before/after the JSON.
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end <= start:
            return None

        try:
            parsed = json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            return None

    if not isinstance(parsed, dict):
        return None

    required = ("plan_a", "plan_b", "plan_c")

    if not all(key in parsed for key in required):
        return None

    return parsed


def _extract_sources(context_payload) -> list:
    """
    Convert structured RAG chunks into simple source metadata for the
    frontend. The actual retrieved text remains available in the RAG layer;
    the formatter only exposes citation information.
    """
    rag_result = getattr(context_payload, "rag_result", None)

    if rag_result is None:
        return []

    sources = []

    for chunk in getattr(rag_result, "chunks", []):
        source = {
            "source": chunk.source,
            "page": chunk.page,
        }

        if source not in sources:
            sources.append(source)

    return sources


def _guardrail_summary(guardrail_result: Optional[dict]) -> dict:
    """Expose only useful guardrail information to downstream layers."""
    result = guardrail_result or {}

    return {
        "valid": result.get("valid", True),
        "unverified_numbers": result.get("unverified_numbers", []),
        "suspiciously_thin": result.get("suspiciously_thin", False),
    }


def _add_guardrail_caution(result: Dict[str, Any], guardrail_result: dict) -> None:
    """
    Add a visible caution when validation is still failing after the
    pipeline's retry attempt.

    The formatter does not modify the LLM's financial figures.
    """
    if guardrail_result.get("valid", True):
        return

    result["guardrail"]["warning"] = (
        "Some figures in this response could not be verified against "
        "the Finance Engine output. Please treat those figures with caution."
    )


# ---------------------------------------------------------------------------
# Main formatter
# ---------------------------------------------------------------------------

def format_response(
    validated_response: str,
    context_payload,
    guardrail_result: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Convert Gemini's response into a structured frontend-friendly dict.

    Args:
        validated_response:
            The final Gemini response after the guardrail/retry loop.

        context_payload:
            ContextPayload produced by context_builder.py. Used to determine
            the entry point, intent, and retrieved RAG sources.

        guardrail_result:
            Result returned by guardrails.validate_numbers().

    Returns:
        A dictionary suitable for pipeline.py/backend consumption.

    Output examples:

        Chat / What-If:
        {
            "type": "answer",
            "content": "...",
            "insight": "...",
            "recommendation": "...",
            "next_steps": [],
            "plans": None,
            "sources": [...],
            "guardrail": {...}
        }

        Plan generation:
        {
            "type": "plan_generation",
            "content": "",
            "plans": {
                "plan_a": {"explanation": "..."},
                "plan_b": {"explanation": "..."},
                "plan_c": {"explanation": "..."}
            },
            ...
        }
    """
    result = _base_result()

    cleaned_response = _clean_text(validated_response)
    entry_point = getattr(context_payload, "entry_point", None)

    result["sources"] = _extract_sources(context_payload)
    result["guardrail"] = _guardrail_summary(guardrail_result)

    # --------------------------------------------------
    # PLAN GENERATION
    # --------------------------------------------------

    if entry_point == "plan_generation":
        plans = _parse_plan_json(cleaned_response)

        if plans is not None:
            result["type"] = "plan_generation"
            result["plans"] = plans
            result["content"] = ""

        else:
            # Do not discard Gemini's answer if it failed to follow the
            # requested JSON shape. Return it as a normal answer instead.
            result["type"] = "plan_generation"
            result["content"] = cleaned_response
            result["plans"] = None
            result["format_warning"] = (
                "The model response was not valid plan JSON, so it was "
                "returned as plain content."
            )

        _add_guardrail_caution(result, guardrail_result or {})
        return result

    # --------------------------------------------------
    # WHAT-IF SIMULATION
    # --------------------------------------------------

    if entry_point == "what_if_simulation":
        result["type"] = "what_if"
        result["content"] = cleaned_response

        _add_guardrail_caution(result, guardrail_result or {})
        return result

    # --------------------------------------------------
    # CHAT
    # --------------------------------------------------

    result["type"] = "answer"
    result["content"] = cleaned_response

    # Keep these fields for compatibility with the older frontend contract.
    # They are populated only when the model happens to use the old
    # INSIGHT / RECOMMENDATION / NEXT STEPS structure.
    result["insight"] = cleaned_response

    intent = getattr(context_payload, "intent", None)

    # The chat-typed WHAT_IF intent is conceptual only. It must not be
    # presented as though a simulation was actually executed.
    if getattr(context_payload, "needs_whatif_nudge", False):
        result["what_if_nudge"] = (
            "Want to see the actual financial impact? Run this scenario "
            "in the What-If Simulator."
        )

    # Low-confidence routing is surfaced to the UI/backend so it can show
    # a suitable footer or indicator without changing the answer itself.
    if getattr(context_payload, "is_low_confidence", False):
        result["low_confidence"] = True
        result["low_confidence_message"] = (
            "This answer is based on a low-confidence interpretation of "
            "your question."
        )
    else:
        result["low_confidence"] = False

    _add_guardrail_caution(result, guardrail_result or {})
    return result
