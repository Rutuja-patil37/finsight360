from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from dotenv import load_dotenv
import os
import sys

# Load .env file from project root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.db import (
    init_db,
    get_user_by_email,
    create_user,
    get_profile_by_email,
    upsert_profile,
    get_goals_by_email,
    add_goal,
    delete_goal,
    save_plan,
    get_plans,
    add_chat_message,
    get_chat_history,
    clear_chat_history
)
from app.genai.schemas import WhatIfScenarioType

app = FastAPI(title="FinSight 360 Unified Backend")

# Setup CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_db():
    init_db()

@app.get("/")
def read_root():
    return {"message": "Welcome to the FinSight 360 Unified Backend API"}

# Authentication
@app.post("/api/v1/auth/check-email")
def check_email(data: dict):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    user = get_user_by_email(email)
    return {"exists": user is not None}

@app.post("/api/v1/auth/register")
def register(data: dict):
    email = data.get("email")
    name = data.get("name")
    password = data.get("password")
    
    if not email or not name or not password:
        raise HTTPException(status_code=400, detail="Email, name, and password are required.")
        
    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    success = create_user(email, name, pwd_hash)
    if not success:
        raise HTTPException(status_code=400, detail="Registration failed. Email might already exist.")
    return {"status": "ok"}

@app.post("/api/v1/auth/login")
def login(data: dict):
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
        
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    if not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    return {"name": user["name"]}

# Profile
@app.get("/api/v1/profile")
def get_profile(email: str):
    profile = get_profile_by_email(email)
    if not profile:
        # Return empty default profile values
        return {
            "age": 0,
            "monthly_income": 0.0,
            "monthly_expense": 0.0,
            "current_savings": 0.0,
            "risk_tolerance": "Medium"
        }
    return {
        "age": profile["age"],
        "monthly_income": profile["monthly_income"],
        "monthly_expense": profile["monthly_expense"],
        "current_savings": profile["current_savings"],
        "risk_tolerance": profile["risk_tolerance"]
    }

@app.post("/api/v1/profile")
def save_profile(email: str, data: dict):
    age = data.get("age")
    monthly_income = data.get("monthly_income") or data.get("monthly_net_income")
    monthly_expense = data.get("monthly_expense") or data.get("monthly_expenses")
    current_savings = data.get("current_savings") or data.get("current_assets")
    risk_tolerance = data.get("risk_tolerance") or data.get("risk_appetite")
    
    if age is None or monthly_income is None or monthly_expense is None or current_savings is None or not risk_tolerance:
        raise HTTPException(status_code=400, detail="All profile fields are required.")
        
    # Preserving existing return rate and inflation if already saved
    existing = get_profile_by_email(email)
    expected_return = existing["expected_return"] if existing else 12.0
    base_inflation = existing["base_inflation"] if existing else 6.0
    
    profile = upsert_profile(
        email=email,
        age=int(age),
        monthly_income=float(monthly_income),
        monthly_expense=float(monthly_expense),
        current_savings=float(current_savings),
        risk_tolerance=str(risk_tolerance),
        expected_return=expected_return,
        base_inflation=base_inflation
    )
    return profile

# Goals
@app.get("/api/v1/goals")
def get_goals(email: str):
    goals = get_goals_by_email(email)
    return [{
        "id": g["id"],
        "name": g["name"],
        "target_amount": g["target_amount"],
        "target_year": g["target_year"],
        "priority": g["priority"]
    } for g in goals]

@app.post("/api/v1/goals")
def create_goal(email: str, data: dict):
    name = data.get("name")
    target_amount = data.get("target_amount")
    target_year = data.get("target_year")
    priority = data.get("priority")
    
    if not name or target_amount is None or target_year is None or not priority:
        raise HTTPException(status_code=400, detail="All goal fields are required.")
        
    goal = add_goal(email, name, float(target_amount), int(target_year), str(priority))
    return {
        "id": goal["id"],
        "name": goal["name"],
        "target_amount": goal["target_amount"],
        "target_year": goal["target_year"],
        "priority": goal["priority"]
    }

@app.delete("/api/v1/goals/{goal_id}")
def remove_goal(goal_id: int, email: str):
    deleted = delete_goal(email, goal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found or unauthorized.")
    return {"status": "ok"}

# GenAI Advisor Chat
@app.post("/api/v1/chat")
def chat(query_data: dict, email: str = "default_user@example.com", growth_rate: float = 12.0, inflation_rate: float = 6.0):
    query = query_data.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
        
    # Update expected return rate and inflation rate in profile database if user exists
    profile = get_profile_by_email(email)
    if profile:
        upsert_profile(
            email=email,
            age=profile["age"],
            monthly_income=profile["monthly_income"],
            monthly_expense=profile["monthly_expense"],
            current_savings=profile["current_savings"],
            risk_tolerance=profile["risk_tolerance"],
            expected_return=growth_rate,
            base_inflation=inflation_rate
        )
    else:
        # Create a default profile with these rates
        upsert_profile(
            email=email,
            age=30,
            monthly_income=120000.0,
            monthly_expense=70000.0,
            current_savings=500000.0,
            risk_tolerance="Medium",
            expected_return=growth_rate,
            base_inflation=inflation_rate
        )
        
    # Parse selected plan from query prefix (e.g. "[Query about Plan A]")
    plan_id = None
    match = re.search(r"\[Query about Plan ([A-C])\]", query, re.IGNORECASE)
    if not match:
        match = re.search(r"\[Plan ([A-C])\]", query, re.IGNORECASE)
        
    if match:
        plan_letter = match.group(1).lower()
        plan_id = f"plan_{plan_letter}"
        # Clean query text
        query = re.sub(r"\[Query about Plan [A-C]\]\s*", "", query, flags=re.IGNORECASE)
        query = re.sub(r"\[Plan [A-C]\]\s*", "", query, flags=re.IGNORECASE)
        
    # Retrieve chat history from DB
    history = get_chat_history(email)
    
    # Save user message to database
    add_chat_message(email, "user", query)
    
    from app.genai.pipeline import handle_chat_request
    
    response_data = handle_chat_request(
        user_id=email,
        query=query,
        plan_id=plan_id,
        chat_history=history
    )
    
    response_text = response_data.get("content") or response_data.get("message") or ""
    
    # If the response is a dict or holds low confidence / nudges, format nicely
    if "what_if_nudge" in response_data and response_data["what_if_nudge"]:
        response_text += f"\n\n*Nudge: {response_data['what_if_nudge']}*"
        
    if "low_confidence" in response_data and response_data["low_confidence"]:
        response_text += f"\n\n*(Note: {response_data.get('low_confidence_message', 'Interpretation warning')})*"
        
    # Save assistant message to database
    add_chat_message(email, "assistant", response_text)
    
    # Cite sources if present
    sources = response_data.get("sources", [])
    if sources:
        source_str = "Reference sources used:\n" + "\n".join(f"- {s.get('source')} (Page {s.get('page')})" for s in sources)
    else:
        source_str = "RAG Context retrieved from vector database."
        
    return {
        "response": response_text,
        "rag_context_used": source_str,
        "insight": response_data.get("insight"),
        "recommendation": response_data.get("recommendation"),
        "next_steps": response_data.get("next_steps"),
        "sources": response_data.get("sources"),
        "guardrail": response_data.get("guardrail"),
        "low_confidence": response_data.get("low_confidence"),
        "what_if_nudge": response_data.get("what_if_nudge")
    }

# Entry Point 2: Generate plans
@app.post("/api/v1/generate-plans")
def generate_plans(email: str):
    from app.genai.pipeline import handle_plan_generation_request
    try:
        res = handle_plan_generation_request(user_id=email)
        if res.get("type") == "plan_generation" and "plans" in res and res["plans"]:
            for plan_id, info in res["plans"].items():
                save_plan(email, plan_id, info.get("explanation", ""), info)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Entry Point 3: What-if Simulation
@app.post("/api/v1/what-if")
def what_if(email: str, scenario: str, params: dict = None):
    from app.genai.pipeline import handle_what_if_request
    try:
        scenario_type = WhatIfScenarioType(scenario)
        return handle_what_if_request(
            user_id=email,
            scenario_type=scenario_type,
            scenario_params=params
        )
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid scenario. Choose from: job_loss, market_crash, salary_hike")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Chat History Endpoints
@app.get("/api/v1/chat/history")
def get_history(email: str):
    history = get_chat_history(email)
    # Format to a simpler role/content shape
    return [{"role": h["role"], "content": h["content"]} for h in history]

@app.delete("/api/v1/chat/history")
def clear_history(email: str):
    clear_chat_history(email)
    return {"status": "ok"}

# Plans Endpoints
@app.get("/api/v1/plans")
def get_user_plans(email: str):
    return get_plans(email)

@app.post("/api/v1/plans")
def save_user_plans(email: str, plans_data: dict):
    # Expecting: {"plan_a": {"explanation": "...", "data": {...}}, ...}
    for plan_id, info in plans_data.items():
        save_plan(email, plan_id, info.get("explanation", ""), info.get("data", {}))
    return {"status": "ok"}
