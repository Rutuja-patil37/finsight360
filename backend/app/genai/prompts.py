"""
prompts.py
-----------
GenAI Orchestration Module - Prompt Builder
Owner: Madhura

Purpose: Takes a ContextPayload (assembled by context_builder.py) and
builds the final prompt string sent to Gemini via gemini_client.py's
plain-text get_completion() function (NOT the JSON-mode function used by
router.py's classifier - this is a different call).

WHAT THIS FILE DOES NOT DO (by design, confirmed decision):
- Does NOT build the low-confidence footer or the what-if-nudge message.
  Those are fixed, deterministic text appended by response_formatter.py
  AFTER the LLM call, using context_payload.is_low_confidence /
  context_payload.needs_whatif_nudge directly. Keeping them out of the
  prompt keeps their wording consistent instead of LLM-paraphrased.

TEMPLATE SELECTION:
    entry_point == "plan_generation"     -> _plan_generation_prompt()
    entry_point == "what_if_simulation"  -> _what_if_prompt()
    entry_point == "chat":
        intent == KNOWLEDGE_QUERY   -> _knowledge_query_prompt()
        intent == FEASIBILITY_CHECK -> _feasibility_check_prompt()
        intent == PLAN_EXPLANATION  -> _plan_explanation_prompt()
        intent == GENERAL_CHAT      -> _general_chat_prompt()
        intent == WHAT_IF           -> _chat_what_if_prompt()

NUMERIC GUARDRAIL NOTE: every template that includes Finance Engine data
explicitly instructs the LLM to only state numbers that appear in the
provided DATA section - this doesn't replace guardrails.py's post-hoc
validation, but reduces how often it needs to catch something.
"""

try:
    from .schemas import ContextPayload, IntentType, RiskAppetite
except ImportError:
    from schemas import ContextPayload, IntentType, RiskAppetite


# ---------------------------------------------------------------------------
# Persona-adaptive tone instructions (based on risk_appetite)
# ---------------------------------------------------------------------------

PERSONA_TONE_INSTRUCTIONS = {
    RiskAppetite.LOW: (
        "The user has a LOW risk appetite. Use cautious, reassuring "
        "language. Emphasize safety, stability, and gradual progress. "
        "Avoid language that sounds pushy about aggressive investing or "
        "risk-taking. When discussing gaps or shortfalls, frame them "
        "gently and focus on practical, low-risk steps forward."
    ),
    RiskAppetite.MEDIUM: (
        "The user has a MEDIUM risk appetite. Use a balanced, practical "
        "tone. Present both safe and moderately growth-oriented options "
        "where relevant, without over-emphasizing either caution or "
        "aggression."
    ),
    RiskAppetite.HIGH: (
        "The user has a HIGH risk appetite. Use a direct, confident tone. "
        "It's fine to discuss growth-oriented strategies and acceptable "
        "risk-taking more matter-of-factly, without excessive hand-holding "
        "or caveats about caution."
    ),
}


# ---------------------------------------------------------------------------
# Shared formatting helpers
# ---------------------------------------------------------------------------

def _format_user_profile(profile) -> str:
    goals_text = "\n".join(
        f"  - {g.description}: target \u20b9{g.target_amount:,.0f} by {g.target_year} "
        f"(priority: {g.priority.value})"
        for g in profile.goals
    ) or "  (no goals on record)"

    return (
        f"Name: {profile.name}, Age: {profile.age}\n"
        f"Monthly net income: \u20b9{profile.monthly_net_income:,.0f}\n"
        f"Monthly expenses: \u20b9{profile.monthly_expenses:,.0f}\n"
        f"Current liquid assets: \u20b9{profile.current_assets:,.0f}\n"
        f"Expected return rate: {profile.expected_return_rate}% p.a.\n"
        f"Base inflation rate: {profile.base_inflation_rate}% p.a.\n"
        f"Risk appetite: {profile.risk_appetite.value}\n"
        f"Goals:\n{goals_text}"
    )


def _format_finance_output(finance_output) -> str:
    """
    Dumps the Finance Engine output (NormalCaseOutput or WhatIfCaseOutput)
    as indented JSON. The LLM is instructed elsewhere to treat every number
    in this block as ground truth - never invent or adjust any of it.
    """
    if finance_output is None:
        return "(no Finance Engine data provided for this query)"
    return finance_output.model_dump_json(indent=2)


def _format_rag_chunks(rag_result) -> str:
    if rag_result is None or not rag_result.chunks:
        return "(no reference material retrieved for this query)"

    parts = []
    for i, chunk in enumerate(rag_result.chunks, start=1):
        parts.append(
            f"[{i}] Source: {chunk.source}, Page: {chunk.page}\n{chunk.text}"
        )
    return "\n\n".join(parts)


def _format_chat_history(chat_history) -> str:
    if not chat_history:
        return "(no prior messages in this conversation)"
    # Exact shape of chat_history items is still TBD (pending backend
    # confirmation) - assumed list of {"role": ..., "content": ...} dicts.
    # Update this formatter once that shape is confirmed.
    lines = []
    for msg in chat_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


_NUMERIC_GUARDRAIL_INSTRUCTION = (
    "IMPORTANT: Only state numbers that appear explicitly in the DATA "
    "section below. Never calculate, estimate, or invent any financial "
    "figure yourself - all math has already been done by a deterministic "
    "engine. If you need to reference a number, copy it exactly as given."
)


# ---------------------------------------------------------------------------
# Per-case prompt templates
# ---------------------------------------------------------------------------

def _plan_generation_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    return f"""You are a personal financial planning assistant. Explain three
generated financial plans (Plan A, Plan B, Plan C) to the user in clear,
personalized language.

{tone}

{_NUMERIC_GUARDRAIL_INSTRUCTION}

USER PROFILE:
{_format_user_profile(context.user_profile)}

FINANCE ENGINE DATA (ground truth for all numbers):
{_format_finance_output(context.finance_engine_output)}

REFERENCE MATERIAL (general guidelines, cite by source when used):
{_format_rag_chunks(context.rag_result)}

Respond with ONLY a JSON object in this exact shape, nothing else:
{{
  "plan_a": {{"explanation": "..."}},
  "plan_b": {{"explanation": "..."}},
  "plan_c": {{"explanation": "..."}}
}}

Each "explanation" should be a few sentences explaining what that plan does,
why it works (or doesn't) for the user's goals, referencing specific numbers
from the FINANCE ENGINE DATA and, where relevant, general guidance from the
REFERENCE MATERIAL.
"""


def _what_if_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    return f"""You are a personal financial planning assistant. Explain the
impact of a what-if scenario the user just simulated, in clear, personalized
language.

{tone}

{_NUMERIC_GUARDRAIL_INSTRUCTION}

USER PROFILE:
{_format_user_profile(context.user_profile)}

SIMULATION RESULTS (ground truth for all numbers):
{_format_finance_output(context.finance_engine_output)}

REFERENCE MATERIAL (general guidelines, cite by source when used):
{_format_rag_chunks(context.rag_result)}

Write a clear explanation of how this scenario affects the user's goals and
overall financial position. Reference specific numbers from the SIMULATION
RESULTS. Where relevant, connect the explanation to general guidance from
the REFERENCE MATERIAL (e.g. why an emergency fund matters here).
"""


def _knowledge_query_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    return f"""You are a personal financial planning assistant. Answer the
user's general question using ONLY the reference material provided below.
Do not reference the user's personal financial data - this is a general
conceptual question.

{tone}

REFERENCE MATERIAL (cite by source when used):
{_format_rag_chunks(context.rag_result)}

USER'S QUESTION: "{context.user_query}"

Answer clearly and concisely, citing which source(s) your answer draws from.
"""


def _feasibility_check_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    return f"""You are a personal financial planning assistant. Answer the
user's question about whether they can afford or reach a specific goal,
using ONLY the Finance Engine data below.

{tone}

{_NUMERIC_GUARDRAIL_INSTRUCTION}

USER PROFILE:
{_format_user_profile(context.user_profile)}

FINANCE ENGINE DATA (ground truth for all numbers):
{_format_finance_output(context.finance_engine_output)}

USER'S QUESTION: "{context.user_query}"

Answer clearly and directly, referencing specific numbers from the data above.
"""


def _plan_explanation_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    plan_note = (
        f"The user is asking about plan: {context.plan_id}\n\n"
        if context.plan_id
        else ""
    )
    return f"""You are a personal financial planning assistant. Answer the
user's question about one of their generated plans, using the Finance
Engine data below.

{tone}

{_NUMERIC_GUARDRAIL_INSTRUCTION}

{plan_note}USER PROFILE:
{_format_user_profile(context.user_profile)}

FINANCE ENGINE DATA (ground truth for all numbers, includes all plans):
{_format_finance_output(context.finance_engine_output)}

REFERENCE MATERIAL (general guidelines, cite by source when used):
{_format_rag_chunks(context.rag_result)}

USER'S QUESTION: "{context.user_query}"

Answer clearly, focusing on the plan the user asked about. Reference
specific numbers from the FINANCE ENGINE DATA and, where relevant, general
guidance from the REFERENCE MATERIAL.
"""


def _general_chat_prompt(context: ContextPayload) -> str:
    return f"""You are a friendly personal financial planning assistant.
Respond naturally and briefly to the user's message below. This is small
talk / a greeting, not a financial question - do not bring up financial
data or advice unless the user's message actually asks for it.

CONVERSATION HISTORY:
{_format_chat_history(context.chat_history)}

USER'S MESSAGE: "{context.user_query}"
"""


def _chat_what_if_prompt(context: ContextPayload) -> str:
    tone = PERSONA_TONE_INSTRUCTIONS[context.user_profile.risk_appetite]
    return f"""You are a personal financial planning assistant. The user
asked a hypothetical "what if" question in chat. Answer it CONCEPTUALLY
using the reference material below - do NOT attempt to calculate or
estimate any specific numeric impact on the user's own finances, since
that requires running an actual simulation (which happens elsewhere, not
in this response).

{tone}

REFERENCE MATERIAL (cite by source when used):
{_format_rag_chunks(context.rag_result)}

USER'S QUESTION: "{context.user_query}"

Answer conceptually - explain the general financial principles at play,
without stating specific numbers for this user's situation.
"""


def build_correction_prompt(original_prompt: str, llm_response: str, guardrail_result: dict) -> str:
    """
    Builds a follow-up prompt asking Gemini to correct itself after
    guardrails.py's validate_numbers() flagged an issue with its previous
    response. Called by pipeline.py's retry loop - see MAX_VALIDATION_RETRIES
    there.
    """
    issues = []

    if guardrail_result.get("unverified_numbers"):
        unverified_str = ", ".join(str(n) for n in guardrail_result["unverified_numbers"])
        issues.append(
            f"- The following numbers in your response could not be "
            f"verified against the actual data and may be incorrect: "
            f"{unverified_str}."
        )

    if guardrail_result.get("suspiciously_thin"):
        issues.append(
            "- Your response didn't include any specific numbers, even "
            "though financial data was available - reference the actual "
            "figures instead of speaking only in general terms."
        )

    issues_text = "\n".join(issues) or "- Some numbers could not be verified."

    ground_truth = guardrail_result.get("ground_truth_numbers", [])
    ground_truth_text = ", ".join(str(n) for n in ground_truth) or "(none available)"

    return f"""Your previous response had a problem with the numbers it used.

PREVIOUS RESPONSE:
{llm_response}

ISSUE(S) FOUND:
{issues_text}

VERIFIED GROUND-TRUTH NUMBERS (only use numbers from this list - do not
calculate, estimate, or invent any number yourself):
{ground_truth_text}

Please regenerate your response, correcting the issue(s) above. Keep the
same tone, structure, and length as your previous response - only fix the
numeric problem.
"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

_CHAT_INTENT_TEMPLATES = {
    IntentType.KNOWLEDGE_QUERY: _knowledge_query_prompt,
    IntentType.FEASIBILITY_CHECK: _feasibility_check_prompt,
    IntentType.PLAN_EXPLANATION: _plan_explanation_prompt,
    IntentType.GENERAL_CHAT: _general_chat_prompt,
    IntentType.WHAT_IF: _chat_what_if_prompt,
}


def build_prompt(context: ContextPayload) -> str:
    """
    Builds the final prompt string for Gemini, based on context.entry_point
    (and context.intent, for the chat entry point).

    This is the ONLY function pipeline.py should call from this file.
    """
    if context.entry_point == "plan_generation":
        return _plan_generation_prompt(context)

    if context.entry_point == "what_if_simulation":
        return _what_if_prompt(context)

    if context.entry_point == "chat":
        template_fn = _CHAT_INTENT_TEMPLATES.get(context.intent)
        if template_fn is None:
            raise ValueError(f"Unhandled chat intent in prompts.py: {context.intent}")
        return template_fn(context)

    raise ValueError(f"Unhandled entry_point in prompts.py: {context.entry_point}")