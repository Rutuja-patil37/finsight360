import sqlite3
import os
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "finsight360.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)
    
    # Create profiles table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            email TEXT PRIMARY KEY,
            age INTEGER NOT NULL,
            monthly_income REAL NOT NULL,
            monthly_expense REAL NOT NULL,
            current_savings REAL NOT NULL,
            risk_tolerance TEXT NOT NULL,
            expected_return REAL DEFAULT 12.0,
            base_inflation REAL DEFAULT 6.0,
            FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
        )
    """)
    
    # Create goals table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            target_year INTEGER NOT NULL,
            priority TEXT NOT NULL,
            FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
        )
    """)

    # Create plans table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plans (
            email TEXT,
            plan_id TEXT,
            explanation TEXT,
            data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (email, plan_id),
            FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
        )
    """)

    # Create chat_history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()

# User CRUD
def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(email: str, name: str, password_hash: str) -> bool:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, name, password) VALUES (?, ?, ?)",
            (email.strip().lower(), name.strip(), password_hash)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

# Profile CRUD
def get_profile_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM profiles WHERE email = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def upsert_profile(
    email: str,
    age: int,
    monthly_income: float,
    monthly_expense: float,
    current_savings: float,
    risk_tolerance: str,
    expected_return: float = 12.0,
    base_inflation: float = 6.0
) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if profile exists
    cursor.execute("SELECT 1 FROM profiles WHERE email = ?", (email.strip().lower(),))
    exists = cursor.fetchone() is not None
    
    if exists:
        cursor.execute("""
            UPDATE profiles 
            SET age = ?, monthly_income = ?, monthly_expense = ?, current_savings = ?, risk_tolerance = ?, expected_return = ?, base_inflation = ?
            WHERE email = ?
        """, (age, monthly_income, monthly_expense, current_savings, risk_tolerance, expected_return, base_inflation, email.strip().lower()))
    else:
        cursor.execute("""
            INSERT INTO profiles (email, age, monthly_income, monthly_expense, current_savings, risk_tolerance, expected_return, base_inflation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (email.strip().lower(), age, monthly_income, monthly_expense, current_savings, risk_tolerance, expected_return, base_inflation))
        
    conn.commit()
    conn.close()
    return {
        "email": email,
        "age": age,
        "monthly_income": monthly_income,
        "monthly_expense": monthly_expense,
        "current_savings": current_savings,
        "risk_tolerance": risk_tolerance,
        "expected_return": expected_return,
        "base_inflation": base_inflation
    }

# Goals CRUD
def get_goals_by_email(email: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM goals WHERE email = ?", (email.strip().lower(),))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_goal(email: str, name: str, target_amount: float, target_year: int, priority: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO goals (email, name, target_amount, target_year, priority)
        VALUES (?, ?, ?, ?, ?)
    """, (email.strip().lower(), name.strip(), target_amount, target_year, priority.strip()))
    goal_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "id": goal_id,
        "email": email,
        "name": name,
        "target_amount": target_amount,
        "target_year": target_year,
        "priority": priority
    }

def delete_goal(email: str, goal_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM goals WHERE id = ? AND email = ?", (goal_id, email.strip().lower()))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# Plans CRUD
def save_plan(email: str, plan_id: str, explanation: str, data: dict) -> bool:
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    data_str = json.dumps(data)
    cursor.execute("""
        INSERT INTO plans (email, plan_id, explanation, data)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email, plan_id) DO UPDATE SET
            explanation = excluded.explanation,
            data = excluded.data,
            created_at = CURRENT_TIMESTAMP
    """, (email.strip().lower(), plan_id.strip(), explanation, data_str))
    conn.commit()
    conn.close()
    return True

def get_plans(email: str) -> Dict[str, Any]:
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT plan_id, explanation, data FROM plans WHERE email = ?", (email.strip().lower(),))
    rows = cursor.fetchall()
    conn.close()
    plans = {}
    for row in rows:
        plans[row["plan_id"]] = {
            "explanation": row["explanation"],
            "data": json.loads(row["data"])
        }
    return plans

# Chat History CRUD
def add_chat_message(email: str, role: str, content: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO chat_history (email, role, content)
        VALUES (?, ?, ?)
    """, (email.strip().lower(), role, content))
    conn.commit()
    conn.close()
    return True

def get_chat_history(email: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT role, content FROM chat_history 
        WHERE email = ? 
        ORDER BY created_at ASC
    """, (email.strip().lower(),))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_chat_history(email: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE email = ?", (email.strip().lower(),))
    conn.commit()
    conn.close()
    return True
