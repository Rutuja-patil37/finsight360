"""
router.py
----------
GenAI Orchestration Module - Intent Router
Owner: Madhura

Purpose: Classifies incoming CHAT queries into an IntentResult (see
schemas.py) so that context_builder.py knows which downstream systems
(RAG, Finance Engine, both, or neither) need to be called, and with
what tone/template prompts.py should respond.

This file is ONLY used for the "chat message" entry point. Plan
Generation and What-If Simulation (button/slider) bypass this file
entirely and construct an IntentResult directly, since their entry
point already tells us what they are.

INTENT -> DATA FETCH MAPPING (enforced by context_builder.py, not here,
but documented so router.py's output makes sense downstream):
    KNOWLEDGE_QUERY    -> RAG only
    FEASIBILITY_CHECK  -> Finance Engine only
    PLAN_EXPLANATION   -> Finance Engine + RAG
    GENERAL_CHAT       -> neither
    WHAT_IF            -> RAG only + nudge toward the What-If Simulator tab.
                          IMPORTANT: this does NOT trigger the Finance
                          Engine simulator. Only the dedicated What-If
                          entry point (button/slider) does that.

LOW CONFIDENCE: when is_low_confidence=True, context_builder.py should
fetch BOTH RAG + Finance Engine regardless of the labeled intent, to
maximize available context. We deliberately do NOT relabel the intent
itself on low confidence (there's no single "catch-all" intent in this
taxonomy) -- the label is kept for prompt-template selection, while the
fetch behavior is broadened via this flag. guardrails.py still protects
against wrong numbers either way.

TEMPORARY INTEGRATION NOTE:
`call_llm_for_classification()` is a placeholder for the real LLM call
that will live in Rutuja's `gemini_client.py`. Swap its body once her
actual function signature is available - nothing else in this file
needs to change.
"""

from typing import Optional

try:
    from .schemas import IntentType, IntentResult
except ImportError:
    from schemas import IntentType, IntentResult


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Below this, LLM classification is treated as low-confidence.
CONFIDENCE_THRESHOLD = 0.6

# --- Rule-based pre-check keyword sets -------------------------------------
# These ONLY fire on unambiguous matches. Anything not clearly matching
# falls through to the LLM classifier - the rules never force a guess.

CHITCHAT_PATTERNS = {
    "hi", "hello", "hey", "hii", "hiii", "good morning", "good afternoon",
    "good evening", "bye", "goodbye", "see you", "thanks", "thank you",
    "thankyou", "ok thanks", "cool", "how are you", "who are you",
    "what can you do",
}

# Generic financial-concept terms - if a query is *only* asking "what is X"
# for one of these, it doesn't need the user's personal data at all.
KNOWLEDGE_QUERY_TERMS = {
    "emergency fund", "sip", "systematic investment plan", "mutual fund",
    "diversification", "compound interest", "inflation", "asset allocation",
    "50/30/20 rule", "credit score", "term insurance", "index fund",
    "expense ratio", "risk appetite", "power of compounding",
}

KNOWLEDGE_QUERY_TRIGGER_PHRASES = ("what is", "what are", "define", "explain", "meaning of")

# Phrases suggesting a from-scratch what-if question typed in chat
# (as opposed to using the slider). Kept intentionally narrow.
WHAT_IF_TRIGGER_PHRASES = ("what if", "what happens if", "suppose i")

# Phrases indicating the query is about a SPECIFIC plan - used to detect
# the "plan-referential but no plan_id" case.
PLAN_REFERENCE_PATTERNS = {
    "this plan", "that plan", "my plan", "the plan", "plan a", "plan b",
    "plan c", "current plan", "selected plan",
}

# Intents for which a missing plan_id may need clarification.
PLAN_SCOPED_INTENTS = (IntentType.FEASIBILITY_CHECK, IntentType.PLAN_EXPLANATION)


# ---------------------------------------------------------------------------
# Rule-based pre-check
# ---------------------------------------------------------------------------

def _rule_based_precheck(query: str) -> Optional[IntentType]:
    """
    Attempts a cheap, high-precision classification using keyword matching.
    Returns an IntentType ONLY when confident. Returns None when the query
    is ambiguous, deferring to the LLM classifier - this function never
    forces a guess on unclear input.
    """
    q = query.strip().lower()

    # General chat: short query that IS (or starts with) a known greeting /
    # small-talk phrase - not just contains one buried in a longer sentence.
    if len(q.split()) <= 4 and any(q == p or q.startswith(p) for p in CHITCHAT_PATTERNS):
        return IntentType.GENERAL_CHAT

    # What-if (chat-typed): starts with a what-if trigger phrase. Deliberately
    # NOT trying to extract scenario_type/duration here - that's out of
    # scope for chat; context_builder.py will treat this as RAG-only + nudge.
    if any(q.startswith(trigger) for trigger in WHAT_IF_TRIGGER_PHRASES):
        return IntentType.WHAT_IF

    # Knowledge query: starts with a definitional trigger phrase AND mentions
    # a known generic term AND has no personal/plan language mixed in
    # (otherwise it's ambiguous - defer to the LLM).
    starts_generic = any(q.startswith(trigger) for trigger in KNOWLEDGE_QUERY_TRIGGER_PHRASES)
    mentions_generic_term = any(term in q for term in KNOWLEDGE_QUERY_TERMS)
    mentions_personal = any(w in q for w in ("my ", "i ", "can i", "should i", "afford"))

    if starts_generic and mentions_generic_term and not mentions_personal:
        return IntentType.KNOWLEDGE_QUERY

    return None


def _is_plan_referential(query: str) -> bool:
    """Detects whether a query is talking about a specific plan."""
    q = query.strip().lower()
    return any(phrase in q for phrase in PLAN_REFERENCE_PATTERNS)


# ---------------------------------------------------------------------------
# LLM classification (placeholder - integration point with gemini_client.py)
# ---------------------------------------------------------------------------
#
# This is a SEPARATE, much smaller LLM call from the main answer-generation
# call that prompts.py builds. It never sees the user profile, RAG results,
# or Finance Engine output - just the raw query, classified into an intent.

_CLASSIFICATION_PROMPT_TEMPLATE = """You are an intent classifier for a personal finance assistant chatbot.
Classify the user's message into EXACTLY ONE of the following intents:

- knowledge_query: a general definitional/conceptual question not about the
  user's own finances (e.g. "what is an emergency fund?", "explain SIP").
- feasibility_check: a question about whether the user can afford or reach
  a specific personal financial goal (e.g. "can I afford a house in 5 years?").
- plan_explanation: a question asking why/how a specific generated plan
  (Plan A/B/C) does something (e.g. "why does plan B delay my vacation?").
- what_if: a hypothetical scenario question typed as free text
  (e.g. "what if I lose my job for 6 months?"). Use this ONLY for
  free-text hypotheticals, not for questions about an existing plan.
- general_chat: greetings, small talk, or anything not related to finance
  (e.g. "hi", "thanks", "who are you").

Respond with ONLY a JSON object in this exact shape, nothing else:
{{"intent": "<one of the five values above>", "confidence": <float between 0.0 and 1.0>}}

User message: "{query}"
"""


def _build_classification_prompt(query: str) -> str:
    """Builds the small classification-only prompt sent to the LLM."""
    return _CLASSIFICATION_PROMPT_TEMPLATE.format(query=query)


def call_llm_for_classification(query: str) -> dict:
    """
    PLACEHOLDER for the gemini_client.py call - replace `_call_gemini_raw()`
    below with the real call into Rutuja's gemini_client.py once available
    (e.g. gemini_client.get_completion(prompt) -> str). It should return
    Gemini's response as PLAIN TEXT - gemini_client.py does NOT need to know
    or care that this particular caller wants JSON. All JSON cleanup/parsing
    happens here in router.py, not in gemini_client.py.

    Flow:
        1. Build the classification prompt via _build_classification_prompt()
        2. Send it to Gemini via gemini_client.py, get raw text back
        3. Clean + parse that text into {"intent": ..., "confidence": ...}

    Returns:
        {
            "intent": one of the IntentType string values,
            "confidence": float   # 0.0 - 1.0
        }
    """
    prompt = _build_classification_prompt(query)
    raw_response = _call_gemini_raw(prompt)
    return _parse_classification_response(raw_response)


def _call_gemini_raw(prompt: str) -> str:
    """Delegates to gemini_client.py's generate_response()."""
    try:
        from . import gemini_client
    except ImportError:
        import gemini_client
    try:
        return gemini_client.generate_response(prompt)
    except Exception as e:
        print(f"[Router] LLM classification error: {e}")
        return '{"intent": "general_chat", "confidence": 0.0}'


def _parse_classification_response(raw_response: str) -> dict:
    """
    Defensively parses Gemini's raw text response into the
    {"intent": ..., "confidence": ...} shape, even if the LLM wrapped the
    JSON in markdown fences or added extra text around it.

    On any parsing failure, falls back to a safe default
    (general_chat, confidence 0.0) rather than crashing the pipeline -
    is_low_confidence will end up True for this, so context_builder.py
    still fetches broadly rather than silently answering the wrong thing.
    """
    import json
    import re

    text = raw_response.strip()

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Last resort: try to pull out just the {...} substring in case
        # there's stray text before/after it.
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            try:
                parsed = json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                parsed = None
        else:
            parsed = None

    if not parsed or "intent" not in parsed or "confidence" not in parsed:
        # Safe fallback - treated as low-confidence general_chat so the
        # pipeline doesn't crash on a malformed LLM response.
        return {"intent": "general_chat", "confidence": 0.0}

    return parsed


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def classify_intent(query: str, plan_id: Optional[str] = None) -> IntentResult:
    """
    Classifies a chat query into an IntentResult.

    This is the ONLY function context_builder.py / backend should call for
    the CHAT entry point. Plan Generation and What-If Simulation do NOT
    call this - see module docstring.

    Args:
        query: raw user chat message text.
        plan_id: optional plan id from the frontend's plan-selector dropdown
                 (Advisor & Queries tab). None if user selected "General"
                 or didn't pick anything.

    Returns:
        IntentResult
    """
    # 1. Try the cheap rule-based pre-check first.
    rule_intent = _rule_based_precheck(query)

    if rule_intent is not None:
        intent = rule_intent
        confidence = 1.0  # rule-based matches are treated as fully confident
        is_low_confidence = False
    else:
        # 2. Defer to the LLM classifier.
        llm_result = call_llm_for_classification(query)
        intent = IntentType(llm_result["intent"])
        confidence = llm_result["confidence"]
        is_low_confidence = confidence < CONFIDENCE_THRESHOLD
        # NOTE: intent is intentionally NOT relabeled on low confidence.
        # context_builder.py handles broadened fetching via is_low_confidence.

    # 3. Detect "plan-referential but no plan_id" - needs a clarification
    #    short-circuit downstream instead of guessing which plan.
    needs_clarification = (
        intent in PLAN_SCOPED_INTENTS
        and plan_id is None
        and _is_plan_referential(query)
    )

    return IntentResult(
        entry_point="chat",
        intent=intent,
        confidence=confidence,
        raw_query=query,
        plan_id=plan_id,
        is_low_confidence=is_low_confidence,
        needs_plan_clarification=needs_clarification,
    )