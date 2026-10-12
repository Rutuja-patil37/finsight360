# backend/app/core/engine.py

from .config import EngineConfig
from .models import UserData, FeasibilityResult, ConflictResult
from .utils import future_value, lumpsum_future_value, inflation_adjust, savings_rate

try:
    import yfinance as yf
except ImportError:
    yf = None


class FinancialEngine:
    def __init__(self, user_data: UserData, config: EngineConfig = EngineConfig()):
        self.data = user_data
        self.config = config
        self.summary = {}
        self.projections = {}
        self.feasibility = []
        self.conflicts = None

    # ---------- Step 1: Analyze current finances ----------
    def analyze(self):
        rate = savings_rate(self.data.income, self.data.expenses)
        monthly_surplus = self.data.income - self.data.expenses

        emergency_months = (
            round(self.data.savings / self.data.expenses, 1)
            if self.data.expenses > 0 else 0
        )

        self.summary = {
            "savings_rate": rate,
            "monthly_surplus": monthly_surplus,
            "current_savings": self.data.savings,
            "emergency_fund_months": emergency_months,
            "emergency_fund_status": (
                "Healthy" if emergency_months >= self.config.EMERGENCY_FUND_MONTHS
                else "Below recommended buffer"
            )
        }
        return self.summary

    # ---------- Live market return (NIFTY via Yahoo Finance) ----------
    def get_market_return(self, ticker="^NSEI", years=10) -> float:
        try:
            if yf is None:
                raise Exception("yfinance not installed")
            hist = yf.download(ticker, period=f"{years}y", progress=False)
            start_price = hist['Close'].iloc[0]
            end_price = hist['Close'].iloc[-1]
            annual_return = (end_price / start_price) ** (1 / years) - 1
            return float(annual_return)
        except Exception:
            return self.config.DEFAULT_RETURN_RATE

    # ---------- Step 2: Project growth, allocated across goals ----------
    def calculate_projections(self, monthly_surplus=None, savings=None, goals=None):
        monthly_surplus = monthly_surplus if monthly_surplus is not None else (self.data.income - self.data.expenses)
        savings = savings if savings is not None else self.data.savings
        goals = goals if goals is not None else self.data.goals

        # Never treat negative cash flow as "negative investment"
        effective_surplus = max(0, monthly_surplus)

        return_rate = self.get_market_return()
        priority_weights = {"High": 3, "Medium": 2, "Low": 1}
        total_weight = sum(priority_weights.get(g.priority, 1) for g in goals)

        projections = {}
        for goal in goals:
            weight = priority_weights.get(goal.priority, 1)
            share = weight / total_weight if total_weight > 0 else 1 / len(goals)

            allocated_surplus = effective_surplus * share
            allocated_savings = savings * share

            fv_from_monthly = future_value(allocated_surplus, return_rate, goal.target_year)
            fv_from_savings = lumpsum_future_value(allocated_savings, return_rate, goal.target_year)

            projections[goal.name] = {
                "projected_amount": round(fv_from_monthly + fv_from_savings, 2),
                "allocated_monthly_surplus": round(allocated_surplus, 2),
                "allocated_savings": round(allocated_savings, 2),
                "return_rate_used": return_rate
            }

        self.projections = projections
        return self.projections

    # ---------- Step 3: Check feasibility per goal ----------
    def check_feasibility(self, projections=None, goals=None):
        projections = projections if projections is not None else self.projections
        goals = goals if goals is not None else self.data.goals

        results = []
        for goal in goals:
            proj = projections[goal.name]["projected_amount"]
            target_adjusted = inflation_adjust(
                goal.target_amount, self.config.DEFAULT_INFLATION_RATE, goal.target_year
            )
            gap = max(0, target_adjusted - proj)
            feasible = proj >= (target_adjusted * self.config.FEASIBILITY_TOLERANCE)

            results.append(FeasibilityResult(
                goal_name=goal.name,
                feasible=feasible,
                projected_amount=proj,
                funding_gap=round(gap, 2),
                years_to_goal=goal.target_year
            ))
        self.feasibility = results
        return self.feasibility

    # ---------- Step 4: Detect conflicts across goals ----------
    def detect_conflicts(self):
        total_gap = sum(f.funding_gap for f in self.feasibility)
        conflicting = total_gap > 0 and len(self.data.goals) > 1

        details = (
            f"Total funding gap across goals: ₹{total_gap:,.2f}. "
            + ("Goals are competing for limited savings." if conflicting else "No major conflict detected.")
        )
        self.conflicts = ConflictResult(conflicting=conflicting, details=details)
        return self.conflicts

    # ---------- Step 5: What-if simulation (on-demand only) ----------
    def simulate(self, scenario: str, months_affected: int = 6, crash_rate: float = -0.20, include_plans: bool = False):
        original_income = self.data.income
        original_savings = self.data.savings
        original_get_market_return = self.get_market_return

        try:
            if scenario == "job_loss":
                monthly_shortfall = self.data.expenses  # income is 0, full expenses become the gap
                total_shortfall = monthly_shortfall * months_affected
                self.data.savings = max(0, self.data.savings - total_shortfall)
                self.data.income = 0

            elif scenario == "salary_hike":
                self.data.income *= 1.10

            elif scenario == "market_crash":
                self.get_market_return = lambda *args, **kwargs: crash_rate

            else:
                return {
                    "scenario": scenario,
                    "error": f"Unsupported scenario '{scenario}'. Supported: job_loss, salary_hike, market_crash"
                }

            self.analyze()
            self.calculate_projections()
            self.check_feasibility()
            self.detect_conflicts()

            response = {
                "scenario": scenario,
                "savings_after_shortfall": self.data.savings if scenario == "job_loss" else None,
                "updated_feasibility": [f.dict() for f in self.feasibility],
                "conflicts": self.conflicts.dict()
            }

            if include_plans:
                response["plans"] = self.generate_plans()

            return response

        finally:
            self.data.income = original_income
            self.data.savings = original_savings
            self.get_market_return = original_get_market_return

    # ---------- Step 6: Generate Plan A / B / C ----------
    def generate_plans(self):
        monthly_surplus = self.data.income - self.data.expenses

        plan_a = {
            "description": "Current path, no changes",
            "feasibility": [f.dict() for f in self.feasibility]
        }

        delayed_goals = []
        delay_summary = {}

        for g in self.data.goals:
            matching_feas = next(f for f in self.feasibility if f.goal_name == g.name)

            if matching_feas.feasible:
                delayed_goals.append(g)
                delay_summary[g.name] = 0
                continue

            extra_years = self.config.PLAN_B_DELAY_YEARS
            for trial_extra in range(1, 11):
                trial_year = g.target_year + trial_extra
                trial_projections = self.calculate_projections(goals=[g.copy(update={"target_year": trial_year})])
                proj_trial = trial_projections[g.name]["projected_amount"]
                target_adjusted = inflation_adjust(g.target_amount, self.config.DEFAULT_INFLATION_RATE, trial_year)

                if proj_trial >= target_adjusted * self.config.FEASIBILITY_TOLERANCE:
                    extra_years = trial_extra
                    break

            delay_summary[g.name] = extra_years
            delayed_goals.append(g.copy(update={"target_year": g.target_year + extra_years}))

        plan_b_projections = self.calculate_projections(goals=delayed_goals)
        plan_b_feasibility = self.check_feasibility(projections=plan_b_projections, goals=delayed_goals)

        plan_b = {
            "description": "Goals delayed by the minimum years needed to become feasible: "
                           + ", ".join(f"{name} +{yrs}yr" for name, yrs in delay_summary.items()),
            "delay_by_goal": delay_summary,
            "feasibility": [f.dict() for f in plan_b_feasibility]
        }

        worst_gap_goal = max(self.feasibility, key=lambda f: f.funding_gap, default=None)

        if worst_gap_goal and worst_gap_goal.funding_gap > 0:
            years_left = max(worst_gap_goal.years_to_goal, 1)
            needed_monthly_extra = worst_gap_goal.funding_gap / (years_left * 12)
            cut_percent = min(needed_monthly_extra / self.data.expenses, 0.5) if self.data.expenses > 0 else 0
        else:
            cut_percent = 0.0

        increased_surplus = monthly_surplus + (self.data.expenses * cut_percent)
        plan_c_projections = self.calculate_projections(monthly_surplus=increased_surplus)
        plan_c_feasibility = self.check_feasibility(projections=plan_c_projections)

        plan_c = {
            "description": f"Cut discretionary expenses by {round(cut_percent*100, 1)}% "
                           f"(₹{round(self.data.expenses * cut_percent, 2)}/month) to close the largest funding gap",
            "cut_percent_calculated": round(cut_percent, 4),
            "feasibility": [f.dict() for f in plan_c_feasibility]
        }

        # Restore engine state to Plan A's numbers
        self.calculate_projections()
        self.check_feasibility()

        return {"plan_a": plan_a, "plan_b": plan_b, "plan_c": plan_c}

    # ---------- Full pipeline ----------
    def run_full_pipeline(self) -> dict:
        self.analyze()
        self.calculate_projections()
        self.check_feasibility()
        self.detect_conflicts()
        plans = self.generate_plans()

        return {
            "summary": self.summary,
            "projections": self.projections,
            "feasibility": [f.dict() for f in self.feasibility],
            "conflicts": self.conflicts.dict(),
            "plans": plans
        }