"""
guardrails.py
--------------
GenAI Orchestration Module - Numeric Guardrail

DESIGN: Pure hallucination detection with smart grounding.
    1. Every number the LLM states is cross-checked against ground truth
       (Finance Engine outputs + User Profile metrics + percentage expansions).
    2. Percentages (e.g. 37.5% from 0.375, 25.6% from 0.2562) and rounded
       monetary values (₹12,812 from 12812.2) are recognized accurately.
    3. If Finance Engine data was provided but the LLM's response
       contains ZERO numbers at all, flagged as suspiciously thin.
"""

import re
from typing import Any, Optional


# ---------------------------------------------------------------------------
# 1. Extract monetary / numeric values from text (LLM response)
# ---------------------------------------------------------------------------

_MONEY_PATTERN = r"(?:\u20b9|INR\s*)?[\d,]+(?:\.\d+)?"
_CITATION_PATTERN = r"\[\d+\]"
_PAGE_PATTERN = r"(?:page|p\.)\s*\d+"


def extract_money_values(text: str) -> list[float]:
    """
    Extracts monetary/numeric values from free text.
    Filters out citation markers like [1] or page numbers before extraction.
    Handles: \u20b92,59,374.25 | \u20b91,00,000 | INR 259374.25 | 259374.25 | 37.5%
    """
    # Remove citations [1], [2] and page references
    cleaned_text = re.sub(_CITATION_PATTERN, "", text, flags=re.IGNORECASE)
    cleaned_text = re.sub(_PAGE_PATTERN, "", cleaned_text, flags=re.IGNORECASE)

    matches = re.findall(_MONEY_PATTERN, cleaned_text)
    values = []
    for match in matches:
        cleaned = match.replace("\u20b9", "").replace("INR", "").replace(",", "").strip()
        if not cleaned:
            continue
        try:
            val = float(cleaned)
            values.append(val)
        except ValueError:
            continue
    return values


# ---------------------------------------------------------------------------
# 2. Recursively flatten numbers out of data structures
# ---------------------------------------------------------------------------

def _flatten_numbers(data: Any) -> list[float]:
    """
    Recursively collects every numeric value from nested dicts, lists, or models.
    Booleans are excluded.
    """
    numbers = []

    if isinstance(data, bool):
        return numbers

    if isinstance(data, (int, float)):
        numbers.append(float(data))

    elif hasattr(data, "model_dump"):
        numbers.extend(_flatten_numbers(data.model_dump()))

    elif isinstance(data, dict):
        for value in data.values():
            numbers.extend(_flatten_numbers(value))

    elif isinstance(data, (list, tuple, set)):
        for item in data:
            numbers.extend(_flatten_numbers(item))

    return numbers


def _expand_ground_truth(raw_numbers: list[float]) -> list[float]:
    """
    Expands ground truth numbers to include percentage equivalents and rounded forms.
    E.g. 0.375 -> 37.5, 0.2562 -> 25.62, 25.6, 0.1 -> 10.
    """
    expanded = set(raw_numbers)

    # Standard conversational/structural numbers
    expanded.update([0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 100.0])

    for num in list(raw_numbers):
        # If number is a rate/percentage between 0 and 1, add percentage forms
        if 0.0 < num <= 1.0:
            pct = num * 100.0
            expanded.add(pct)
            expanded.add(round(pct, 1))
            expanded.add(round(pct, 2))
            expanded.add(round(pct, 0))

        # Add rounded forms
        expanded.add(round(num, 0))
        expanded.add(round(num, 1))
        expanded.add(round(num, 2))

    return list(expanded)


# ---------------------------------------------------------------------------
# 3. Main guardrail check
# ---------------------------------------------------------------------------

def validate_numbers(
    llm_response: str,
    finance_engine_output: Optional[Any],
    user_profile: Optional[Any] = None,
    tolerance: float = 0.05,
) -> dict:
    """
    Cross-checks numbers in llm_response against finance_engine_output and user_profile.
    """
    llm_numbers = extract_money_values(llm_response)

    if finance_engine_output is None and user_profile is None:
        return {
            "valid": True,
            "unverified_numbers": [],
            "suspiciously_thin": False,
            "llm_numbers": llm_numbers,
            "ground_truth_numbers": [],
        }

    raw_numbers = []
    if finance_engine_output is not None:
        raw_numbers.extend(_flatten_numbers(finance_engine_output))
    if user_profile is not None:
        raw_numbers.extend(_flatten_numbers(user_profile))

    ground_truth_numbers = _expand_ground_truth(raw_numbers)

    unverified_numbers = []
    for llm_value in llm_numbers:
        matched = any(
            abs(llm_value - truth_value) <= max(tolerance, 0.02 * abs(truth_value), 1.0)
            for truth_value in ground_truth_numbers
        )
        if not matched:
            unverified_numbers.append(llm_value)

    suspiciously_thin = (finance_engine_output is not None) and len(llm_numbers) == 0

    return {
        "valid": len(unverified_numbers) == 0 and not suspiciously_thin,
        "unverified_numbers": unverified_numbers,
        "suspiciously_thin": suspiciously_thin,
        "llm_numbers": llm_numbers,
        "ground_truth_numbers": ground_truth_numbers,
    }