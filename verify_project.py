import sys
import os
import unittest
from datetime import datetime

# Adjust path to import backend app
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

class TestFinSight360Core(unittest.TestCase):
    
    def test_calculator_compounding(self):
        from app.core.calculator import calculate_future_value
        # principal = $10,000, monthly_savings = $500 (periodic_addition = $6,000/yr), 0% rate, 5 years
        val = calculate_future_value(10000, 6000, 0, 5)
        self.assertEqual(val, 40000)
        
        # principal = $10,000, periodic_addition = $12,000/yr, 10% rate, 1 year
        # FV = 10000 * 1.10 + 12000 = 11000 + 12000 = 23000
        val2 = calculate_future_value(10000, 12000, 10.0, 1)
        self.assertAlmostEqual(val2, 23000.0)

    def test_cash_flow_analysis(self):
        from app.core.data_analysis import analyze_cash_flow
        
        txs = [
            {"amount": 5000.0, "date": "2026-08-01", "category": "Salary", "type": "Income"},
            {"amount": 1500.0, "date": "2026-08-02", "category": "Rent", "type": "Expense"},
            {"amount": 500.0, "date": "2026-08-03", "category": "Groceries", "type": "Expense"}
        ]
        
        analysis = analyze_cash_flow(txs, 5000.0, 3000.0)
        self.assertEqual(analysis["total_income"], 5000.0)
        self.assertEqual(analysis["total_expense"], 2000.0)
        self.assertEqual(analysis["net_savings"], 3000.0)
        self.assertEqual(analysis["savings_rate"], 0.6)
        self.assertEqual(len(analysis["top_expense_categories"]), 2)
        self.assertEqual(analysis["top_expense_categories"][0]["category"], "Rent")

    def test_goal_feasibility(self):
        from app.core.feasibility import check_goal_feasibility
        
        # House goal of $100,000 in 10 years
        # Save $1,000/mo ($12,000/yr), starting at $0, 7% growth, 0% inflation
        res = check_goal_feasibility(
            initial_corpus=0.0,
            monthly_savings=1000.0,
            growth_rate=7.0,
            inflation_rate=0.0,
            current_year=2026,
            goal_name="House",
            goal_target_amount=100000.0,
            goal_target_year=2036
        )
        self.assertTrue(res["feasible"])
        self.assertEqual(res["funding_gap"], 0.0)

    def test_goal_conflict_sequential(self):
        from app.core.conflict import detect_goal_conflicts
        
        # High priority Goal 1: $10,000 in 1 year
        # Medium priority Goal 2: $50,000 in 2 years
        # Start with $0, savings = $500/mo ($6,000/yr), growth = 0%, inflation = 0%
        goals = [
            {"name": "Goal 1", "target_amount": 10000.0, "target_year": 2027, "priority": "High"},
            {"name": "Goal 2", "target_amount": 50000.0, "target_year": 2028, "priority": "Medium"}
        ]
        
        res = detect_goal_conflicts(
            initial_corpus=0.0,
            monthly_savings=500.0,
            growth_rate=0.0,
            inflation_rate=0.0,
            current_year=2026,
            goals=goals
        )
        
        # Year 1 (2027): save $6,000. Goal 1 costs $10,000. Deficit of $4,000. Goal 1 is un-funded.
        self.assertTrue(res["has_conflicts"])
        self.assertFalse(res["goal_statuses"][0]["is_funded"])
        self.assertEqual(res["goal_statuses"][0]["deficit"], 4000.0)

    def test_alternative_plans(self):
        from app.core.optimizer import generate_alternative_plans
        
        goals = [
            {"name": "Goal 1", "target_amount": 10000.0, "target_year": 2027, "priority": "High"},
            {"name": "Goal 2", "target_amount": 50000.0, "target_year": 2028, "priority": "Medium"}
        ]
        
        plans = generate_alternative_plans(
            initial_corpus=10000.0,
            monthly_income=5000.0,
            monthly_expense=4000.0, # monthly savings = $1,000 ($12k/yr)
            growth_rate=0.0,
            inflation_rate=0.0,
            current_year=2026,
            goals=goals
        )
        
        self.assertIn("PlanA", plans)
        self.assertIn("PlanB", plans)
        self.assertIn("PlanC", plans)
        self.assertIn("recommendation", plans)

    def test_rag_chunking(self):
        from app.rag.loader import chunk_text
        text = "This is a sample document for testing RAG pipeline chunking. It should be parsed into small segments."
        chunks = chunk_text(text, "test.txt", chunk_size=20, overlap=5)
        self.assertTrue(len(chunks) > 0)
        self.assertEqual(chunks[0]["source"], "test.txt")

if __name__ == "__main__":
    unittest.main()
