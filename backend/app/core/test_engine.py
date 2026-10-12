from core.models import UserData, Goal
from core.engine import FinancialEngine
import json

user = UserData(
    income=80000,
    expenses=50000,
    savings=500000,
    goals=[
        Goal(name="House", target_amount=2000000, target_year=5, priority="High"),
        Goal(name="Car", target_amount=800000, target_year=3, priority="Medium"),
        Goal(name="Vacation", target_amount=300000, target_year=2, priority="Low")
    ]
)

engine = FinancialEngine(user)

result = engine.run_full_pipeline()
print("=== NORMAL PLAN ===")
print(json.dumps(result, indent=2, ensure_ascii=False))

crash_result = engine.simulate(scenario="market_crash", include_plans=True)
print("=== MARKET CRASH ===")
print(json.dumps(crash_result, indent=2, ensure_ascii=False))

job_loss_result = engine.simulate(scenario="job_loss", include_plans=True)
print("=== JOB LOSS ===")
print(json.dumps(job_loss_result, indent=2, ensure_ascii=False))

salary_hike_result = engine.simulate(scenario="salary_hike", include_plans=True)
print("=== SALARY HIKE ===")
print(json.dumps(salary_hike_result, indent=2, ensure_ascii=False))