"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
  Zap,
  ChevronDown,
  Plus,
  Minus,
  TrendingUp,
  AlertTriangle,
  PlusCircle,
  Trash2,
  Lock,
  ArrowUpRight,
  TrendingDown,
  Info,
  Calendar,
  AlertCircle,
  Sliders,
  DollarSign,
  ShieldAlert
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ProjectionChart from "@/components/ProjectionChart";
import SimulatorControls from "@/components/SimulatorControls";
import RagChat from "@/components/RagChat";
import GoalFundingChart from "@/components/GoalFundingChart";
import AuthGate from "@/components/AuthGate";
import {
  Goal,
  UserProfile,
  Transaction,
  generateAlternativePlans,
  simulateScenario,
  analyzeCashFlow,
  checkGoalFeasibility,
  calculateFutureValue,
  TrajectoryPoint,
  PlansResponse,
  AnalysisResponse
} from "@/lib/financialEngine";

// Default seed values matching backend
const DEFAULT_PROFILE: UserProfile = {
  age: 0,
  monthly_income: 0,
  monthly_expense: 0,
  current_savings: 0,
  risk_tolerance: "Medium",
};

const DEFAULT_GOALS: Goal[] = [];

const DEFAULT_TRANSACTIONS: Transaction[] = [];

export default function Home() {
  const [isCockpitOpen, setIsCockpitOpen] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("Alex");
  const [activeTab, setActiveTab] = useState("Profile & Goals");
  const [expandedPlanA, setExpandedPlanA] = useState(true);
  const [expandedPlanB, setExpandedPlanB] = useState(true);
  const [expandedPlanC, setExpandedPlanC] = useState(true);
  const [aiPlans, setAiPlans] = useState<any>(null);
  const [isGeneratingPlans, setIsGeneratingPlans] = useState<boolean>(false);
  const [simAiResponse, setSimAiResponse] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Teaser compounding calculator states for Landing Page
  const [teaserContribution, setTeaserContribution] = useState<number>(15000);
  const [teaserYears, setTeaserYears] = useState<number>(20);
  const [teaserReturnRate, setTeaserReturnRate] = useState<number>(12);

  // Core Financial States
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [expectedReturn, setExpectedReturn] = useState<number>(12);
  const [inflationRate, setInflationRate] = useState<number>(6);

  // Form states
  const [incomeInput, setIncomeInput] = useState<number>(120000);
  const [expenseInput, setExpenseInput] = useState<number>(70000);
  const [savingsInput, setSavingsInput] = useState<number>(500000);
  const [ageInput, setAgeInput] = useState<number>(30);
  const [riskInput, setRiskInput] = useState<string>("Medium");
  
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState<number | string>(1500000);
  const [newGoalYears, setNewGoalYears] = useState<number | string>(5);
  const [newGoalPriority, setNewGoalPriority] = useState<string>("Medium");

  // What-If Simulator modifier states
  const [simScenarioType, setSimScenarioType] = useState<string>("none");
  const [simScenarioParams, setSimScenarioParams] = useState<any>({});

  // FAQ collapse state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const syncFromBackend = async () => {
    try {
      const email = localStorage.getItem("finsight360_user_email") || "";
      const profRes = await fetch(`http://localhost:8000/api/v1/profile?email=${email}`);
      if (profRes.ok) {
        const prof = await profRes.json();
        const updatedProfile = {
          age: prof.age,
          monthly_income: prof.monthly_income,
          monthly_expense: prof.monthly_expense,
          current_savings: prof.current_savings,
          risk_tolerance: prof.risk_tolerance,
        };
        setProfile(updatedProfile);
        setIncomeInput(prof.monthly_income);
        setExpenseInput(prof.monthly_expense);
        setSavingsInput(prof.current_savings);
        setAgeInput(prof.age);
        setRiskInput(prof.risk_tolerance);
        saveState("finsight_profile_v2", updatedProfile);
      }

      const goalsRes = await fetch(`http://localhost:8000/api/v1/goals?email=${email}`);
      if (goalsRes.ok) {
        const backendGoals = await goalsRes.json();
        const currYr = new Date().getFullYear();
        const formattedGoals = backendGoals.map((g: any) => {
          const rawYr = Number(g.target_year);
          const validYr = (!isNaN(rawYr) && rawYr >= currYr) ? rawYr : (currYr + 2);
          return {
            id: g.id,
            name: g.name || "Target Goal",
            target_amount: Number(g.target_amount) || 0,
            target_year: validYr,
            priority: g.priority || "Medium",
          };
        });
        setGoals(formattedGoals);
        saveState("finsight_goals_v2", formattedGoals);
      }
    } catch (err) {
      console.warn("FastAPI backend server offline, using local localStorage values:", err);
    }
  };

  // Load from localStorage on mount and sync with backend
  useEffect(() => {
    const loggedIn = localStorage.getItem("finsight360_logged_in") === "true";
    setIsLoggedIn(loggedIn);
    const name = localStorage.getItem("finsight360_user_name") || "Alex";
    setUserName(name);

    const storedProfile = localStorage.getItem("finsight_profile_v2");
    const storedGoals = localStorage.getItem("finsight_goals_v2");
    const storedTransactions = localStorage.getItem("finsight_transactions_v2");
    const storedReturn = localStorage.getItem("finsight_return_rate_v2");
    const storedInflation = localStorage.getItem("finsight_inflation_rate_v2");

    if (storedProfile) {
      const parsed = JSON.parse(storedProfile);
      setProfile(parsed);
      setIncomeInput(parsed.monthly_income);
      setExpenseInput(parsed.monthly_expense);
      setSavingsInput(parsed.current_savings);
      setAgeInput(parsed.age || 30);
      setRiskInput(parsed.risk_tolerance || "Medium");
    }
    if (storedGoals) {
      try {
        const currYr = new Date().getFullYear();
        const parsed: Goal[] = JSON.parse(storedGoals);
        const sanitized = parsed.map((g) => {
          const rawYr = Number(g.target_year);
          const validYr = (!isNaN(rawYr) && rawYr >= currYr) ? rawYr : (currYr + 2);
          return {
            ...g,
            target_amount: Number(g.target_amount) || 0,
            target_year: validYr,
          };
        });
        setGoals(sanitized);
      } catch (e) {
        console.error(e);
      }
    }
    if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
    if (storedReturn) setExpectedReturn(Number(storedReturn));
    if (storedInflation) setInflationRate(Number(storedInflation));

    syncFromBackend();
  }, []);

  const saveState = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const handleResetData = () => {
    if (window.confirm("Are you sure you want to reset all simulation data back to defaults?")) {
      localStorage.clear();
      setProfile(DEFAULT_PROFILE);
      setGoals(DEFAULT_GOALS);
      setTransactions(DEFAULT_TRANSACTIONS);
      setExpectedReturn(12);
      setInflationRate(6);
      setIncomeInput(DEFAULT_PROFILE.monthly_income);
      setExpenseInput(DEFAULT_PROFILE.monthly_expense);
      setSavingsInput(DEFAULT_PROFILE.current_savings);
      setAgeInput(DEFAULT_PROFILE.age);
      setRiskInput(DEFAULT_PROFILE.risk_tolerance);
      
      saveState("finsight_profile_v2", DEFAULT_PROFILE);
      saveState("finsight_goals_v2", DEFAULT_GOALS);
      saveState("finsight_transactions_v2", DEFAULT_TRANSACTIONS);
      localStorage.setItem("finsight_return_rate_v2", "12");
      localStorage.setItem("finsight_inflation_rate_v2", "6");
      localStorage.removeItem("finsight_chat_history_v2");
      window.location.reload();
    }
  };

  // What-If Simulator GenAI fetch effect
  useEffect(() => {
    if (simScenarioType === "none") {
      setSimAiResponse(null);
      return;
    }
    const email = localStorage.getItem("finsight360_user_email") || "";
    setIsSimulating(true);
    
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // Map frontend parameter names to what backend expect
      let mappedParams = { ...simScenarioParams };
      if (simScenarioType === "job_loss" && simScenarioParams.months !== undefined) {
        mappedParams = {
          months_affected: simScenarioParams.months
        };
      } else if (simScenarioType === "market_crash" && simScenarioParams.percentage !== undefined) {
        mappedParams = {
          crash_rate: - (simScenarioParams.percentage / 100)
        };
      }

      fetch(`http://localhost:8000/api/v1/what-if?email=${email}&scenario=${simScenarioType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappedParams),
        signal: controller.signal
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Simulation failed");
        })
        .then(data => {
          setSimAiResponse(data);
        })
        .catch(err => {
          if (err.name !== "AbortError") {
            console.error("Failed to run what-if simulation on backend", err);
          }
        })
        .finally(() => {
          setIsSimulating(false);
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [simScenarioType, simScenarioParams]);

  const currentYear = new Date().getFullYear();

  // Trajectory Projector (Always 30 years to align with ending assets card ₹38,11,708)
  const trajectoryYears = 30;

  // 1. Alternate Plans (A, B, C)
  const plans: PlansResponse = generateAlternativePlans(
    savingsInput,
    incomeInput,
    expenseInput,
    expectedReturn,
    inflationRate,
    currentYear,
    goals
  );

  const planATrajectory = projectTrajectoryForPlan(savingsInput, plans.PlanA.monthly_savings);
  const planBTrajectory = projectTrajectoryForPlan(savingsInput, plans.PlanB.monthly_savings, true);
  const planCTrajectory = projectTrajectoryForPlan(savingsInput, plans.PlanC.monthly_savings);

  const sanitizeItem = (item: any) => {
    const name = item.goal_name || item.name || item.description || "Target Goal";
    const matchingGoal = goals.find(g => g.name.toLowerCase() === name.toLowerCase());

    // Target Year & Years Remaining
    let yrsRem = 2;
    const rawYrs = item.years_remaining !== undefined && !isNaN(Number(item.years_remaining))
      ? Number(item.years_remaining)
      : (item.years_to_goal !== undefined && !isNaN(Number(item.years_to_goal))
          ? Number(item.years_to_goal)
          : undefined);

    if (rawYrs !== undefined) {
      if (rawYrs > 100) {
        yrsRem = Math.max(0, rawYrs - currentYear);
      } else {
        yrsRem = Math.max(0, rawYrs);
      }
    } else if (item.target_year !== undefined && !isNaN(Number(item.target_year))) {
      const ty = Number(item.target_year);
      yrsRem = Math.max(0, ty > 100 ? (ty - currentYear) : ty);
    } else if (matchingGoal) {
      yrsRem = Math.max(0, matchingGoal.target_year - currentYear);
    }

    let tYear = currentYear + yrsRem;
    if (item.target_year !== undefined && !isNaN(Number(item.target_year)) && Number(item.target_year) > 100) {
      tYear = Number(item.target_year);
    } else if (matchingGoal && matchingGoal.target_year > 100) {
      tYear = matchingGoal.target_year;
    }

    // Future Cost
    let fCost = 0;
    if (item.future_cost !== undefined && !isNaN(Number(item.future_cost)) && Number(item.future_cost) > 0 && Number(item.future_cost) < 1e12) {
      fCost = Number(item.future_cost);
    } else if (item.original_cost !== undefined && !isNaN(Number(item.original_cost)) && Number(item.original_cost) > 0) {
      fCost = Number(item.original_cost) * Math.pow(1 + inflationRate / 100, yrsRem);
    } else if (matchingGoal && matchingGoal.target_amount > 0) {
      fCost = matchingGoal.target_amount * Math.pow(1 + inflationRate / 100, yrsRem);
    }

    // Projected Corpus / Money
    let pCorpus = 0;
    if (item.projected_corpus !== undefined && !isNaN(Number(item.projected_corpus)) && Number(item.projected_corpus) > 0 && Number(item.projected_corpus) < 1e12) {
      pCorpus = Number(item.projected_corpus);
    } else if (item.projected_amount !== undefined && !isNaN(Number(item.projected_amount)) && Number(item.projected_amount) > 0 && Number(item.projected_amount) < 1e12) {
      pCorpus = Number(item.projected_amount);
    } else if (item.available_corpus_before !== undefined && !isNaN(Number(item.available_corpus_before)) && Number(item.available_corpus_before) > 0 && Number(item.available_corpus_before) < 1e12) {
      pCorpus = Number(item.available_corpus_before);
    }

    if (pCorpus <= 0 || pCorpus >= 1e12) {
      // Re-calculate normal compound corpus over yrsRem
      pCorpus = calculateFutureValue(savingsInput, incomeInput - expenseInput, expectedReturn, yrsRem);
    }

    // Funding Gap: STRICTLY fCost - pCorpus if fCost > pCorpus, else 0
    let fGap = 0;
    if (fCost > pCorpus) {
      fGap = fCost - pCorpus;
    } else {
      fGap = 0;
    }

    // Feasible: STRICTLY true when pCorpus >= fCost (fGap === 0)
    const isFeasible = fGap === 0 || pCorpus >= fCost;

    return {
      ...item,
      goal_name: name,
      target_year: tYear,
      years_remaining: yrsRem,
      future_cost: Math.round(fCost),
      projected_corpus: Math.round(pCorpus),
      funding_gap: Math.round(fGap),
      feasible: isFeasible
    };
  };

  const rawPlanA = aiPlans?.finance_engine_output?.plans?.plan_a?.feasibility || 
    plans.PlanA.goal_statuses.map((s: any) => ({
      goal_name: s.name,
      target_year: s.target_year,
      years_remaining: Math.max(0, s.target_year - currentYear),
      future_cost: s.future_cost,
      projected_corpus: s.available_corpus_before,
      funding_gap: s.deficit,
      feasible: s.is_funded
    }));
  const planAItems = (rawPlanA || []).map(sanitizeItem);

  const rawPlanB = aiPlans?.finance_engine_output?.plans?.plan_b?.feasibility || 
    plans.PlanB.goal_statuses.map((s: any) => ({
      goal_name: s.name,
      target_year: s.target_year,
      years_remaining: Math.max(0, s.target_year - currentYear),
      future_cost: s.future_cost,
      projected_corpus: s.available_corpus_before,
      funding_gap: s.deficit,
      feasible: s.is_funded
    }));
  const planBItems = (rawPlanB || []).map(sanitizeItem);

  const rawPlanC = aiPlans?.finance_engine_output?.plans?.plan_c?.feasibility || 
    plans.PlanC.goal_statuses.map((s: any) => ({
      goal_name: s.name,
      target_year: s.target_year,
      years_remaining: Math.max(0, s.target_year - currentYear),
      future_cost: s.future_cost,
      projected_corpus: s.available_corpus_before,
      funding_gap: s.deficit,
      feasible: s.is_funded
    }));
  const planCItems = (rawPlanC || []).map(sanitizeItem);

  function projectTrajectoryForPlan(initial: number, monthly: number, delayGoals = false) {
    const adjustedGoals = goals.map((g) => {
      let year = g.target_year;
      if (delayGoals) {
        const priority = g.priority.toLowerCase();
        if (priority === "medium") year += 2;
        else if (priority === "low") year += 5;
      }
      return { ...g, target_year: year };
    });

    const sorted = [...adjustedGoals].sort((a, b) => a.target_year - b.target_year);
    const traj: TrajectoryPoint[] = [];
    let currentCorpus = initial;
    const rate = expectedReturn / 100.0;
    const inf = inflationRate / 100.0;
    const annualSavings = monthly * 12.0;

    traj.push({ year_index: 0, nominal_corpus: currentCorpus, real_corpus: currentCorpus });

    for (let y = 1; y <= trajectoryYears; y++) {
      const activeYear = currentYear + y;
      
      const interest = currentCorpus * rate;
      currentCorpus = currentCorpus + interest + annualSavings;

      sorted.forEach((g) => {
        if (g.target_year === activeYear) {
          const futureCost = g.target_amount * Math.pow(1 + inf, y);
          currentCorpus -= futureCost;
        }
      });

      if (currentCorpus < 0) {
        currentCorpus = 0;
      }

      traj.push({
        year_index: y,
        nominal_corpus: Math.round(currentCorpus),
        real_corpus: Math.round(currentCorpus / Math.pow(1 + inf, y)),
      });
    }
    return traj;
  }

  // 2. What-If Trajectories (3 plans Shocked under macroeconomic stress)
  // 2. What-If Trajectories (3 plans Shocked under macroeconomic stress)
  const simResultsA = simulateScenario(
    incomeInput,
    expenseInput,
    savingsInput,
    expectedReturn,
    inflationRate,
    currentYear,
    trajectoryYears,
    simScenarioType,
    simScenarioParams
  );
  const shockedPlanATrajectory = projectSimulationTrajectory(simResultsA.trajectory, false);

  const simResultsB = simulateScenario(
    incomeInput,
    expenseInput,
    savingsInput,
    expectedReturn,
    inflationRate,
    currentYear,
    trajectoryYears,
    simScenarioType,
    simScenarioParams
  );
  const shockedPlanBTrajectory = projectSimulationTrajectory(simResultsB.trajectory, true);

  const simResultsC = simulateScenario(
    incomeInput,
    incomeInput - plans.PlanC.monthly_savings,
    savingsInput,
    expectedReturn,
    inflationRate,
    currentYear,
    trajectoryYears,
    simScenarioType,
    simScenarioParams
  );
  const shockedPlanCTrajectory = projectSimulationTrajectory(simResultsC.trajectory, false);

  function projectSimulationTrajectory(rawTrajectory: TrajectoryPoint[], delayGoals = false) {
    const adjustedGoals = goals.map((g) => {
      let year = g.target_year;
      if (delayGoals) {
        const priority = g.priority.toLowerCase();
        if (priority === "medium") year += 2;
        else if (priority === "low") year += 5;
      }
      return { ...g, target_year: year };
    });

    const sorted = [...adjustedGoals].sort((a, b) => a.target_year - b.target_year);
    const inf = inflationRate / 100.0;
    const traj: TrajectoryPoint[] = [];
    let deficitAdjustment = 0;

    rawTrajectory.forEach((point) => {
      const y = point.year_index;
      const activeYear = currentYear + y;
      let nominal = point.nominal_corpus - deficitAdjustment;

      sorted.forEach((g) => {
        if (g.target_year === activeYear) {
          const futureCost = g.target_amount * Math.pow(1 + inf, y);
          nominal -= futureCost;
        }
      });

      if (nominal < 0) {
        deficitAdjustment += Math.abs(nominal);
        nominal = 0;
      }

      traj.push({
        ...point,
        nominal_corpus: nominal,
        real_corpus: nominal / Math.pow(1 + inf, y),
      });
    });

    return traj;
  }

  // Metrics (Clamped to >= 0 so negative values are never displayed)
  const netMonthlySavings = Math.max(0, incomeInput - expenseInput);
  const monthlySavingsRate = incomeInput > 0 ? Math.max(0, Math.round((netMonthlySavings / incomeInput) * 100)) : 0;
  const emergencyBufferMonths = expenseInput > 0 ? Math.max(0, Number((savingsInput / expenseInput).toFixed(1))).toFixed(1) : "0.0";
  const hasConflicts = plans.PlanA.has_conflicts;

  // Goal feasibility index logic (Image 1 uses 67% representing 2 of 3 goals funded)
  const getFeasibilityIndex = () => {
    if (goals.length === 0) return 0;
    let funded = 0;
    goals.forEach((g) => {
      const f = checkGoalFeasibility(
        savingsInput,
        netMonthlySavings,
        expectedReturn,
        inflationRate,
        currentYear,
        g.name,
        g.target_amount,
        g.target_year
      );
      if (f.feasible) funded++;
    });
    return Math.round((funded / goals.length) * 100);
  };

  const handleUpdateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseInput > incomeInput) {
      alert(`⚠️ Critical Financial Deficit Error:\n\nMonthly Expenses (₹${expenseInput.toLocaleString("en-IN")}) exceed Monthly Income (₹${incomeInput.toLocaleString("en-IN")}) by ₹${(expenseInput - incomeInput).toLocaleString("en-IN")}/month!\n\nPlease adjust your monthly expenses or income to a sustainable positive balance.`);
      return;
    }
    const updated: UserProfile = {
      ...profile,
      age: ageInput,
      risk_tolerance: riskInput,
      monthly_income: incomeInput,
      monthly_expense: expenseInput,
      current_savings: savingsInput,
    };
    setProfile(updated);
    saveState("finsight_profile_v2", updated);
    localStorage.setItem("finsight_return_rate_v2", expectedReturn.toString());
    localStorage.setItem("finsight_inflation_rate_v2", inflationRate.toString());

    const email = localStorage.getItem("finsight360_user_email") || "";
    fetch(`http://localhost:8000/api/v1/profile?email=${email}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    })
      .then(() => alert("Profile settings updated & synced to database successfully!"))
      .catch((err) => {
        console.warn("Failed to sync profile to FastAPI backend:", err);
        alert("Profile settings updated locally (offline mode).");
      });
  };

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;
    const yearsNum = Number(newGoalYears) || 1;
    const computedTargetYear = currentYear + yearsNum;
    const tempGoal = {
      name: newGoalName.trim(),
      target_amount: Number(newGoalAmount) || 0,
      target_year: computedTargetYear,
      priority: newGoalPriority,
    };

    const email = localStorage.getItem("finsight360_user_email") || "";
    fetch(`http://localhost:8000/api/v1/goals?email=${email}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tempGoal),
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to add goal");
        return res.json();
      })
      .then(newDbGoal => {
        const updated = [...goals, {
          id: newDbGoal.id,
          name: newDbGoal.name,
          target_amount: newDbGoal.target_amount,
          target_year: newDbGoal.target_year,
          priority: newDbGoal.priority,
        }];
        setGoals(updated);
        saveState("finsight_goals_v2", updated);
        setNewGoalName("");
        alert("Goal added and synced to database!");
      })
      .catch(err => {
        console.warn("Failed to sync goal to FastAPI backend:", err);
        const updated = [...goals, tempGoal];
        setGoals(updated);
        saveState("finsight_goals_v2", updated);
        setNewGoalName("");
        alert("Goal added locally (offline mode).");
      });
  };

  const handleDeleteGoal = (index: number) => {
    const goalToDelete = goals[index];
    const updated = goals.filter((_, i) => i !== index);
    setGoals(updated);
    saveState("finsight_goals_v2", updated);

    if (goalToDelete.id) {
      const email = localStorage.getItem("finsight360_user_email") || "";
      fetch(`http://localhost:8000/api/v1/goals/${goalToDelete.id}?email=${email}`, {
        method: "DELETE",
      }).catch(err => console.warn("Failed to delete goal from FastAPI backend:", err));
    }
  };

  // Teaser compounding calculator wealth formula
  const getTeaserWealth = () => {
    const P = teaserContribution;
    const r = teaserReturnRate / 100 / 12;
    const n = teaserYears * 12;
    if (r === 0) return P * n;
    return Math.round(P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  };
  const getTeaserInvested = () => teaserContribution * 12 * teaserYears;
  const getTeaserInterest = () => getTeaserWealth() - getTeaserInvested();

  // FAQs
  const faqs = [
    {
      q: "Does FinSight 360 require an active server connection?",
      a: "No. This polished prototype performs all complex goal conflict, compounding, and stress simulations completely in client-side React code. RAG documents are semantically resolved offline, making the app blazingly fast and private."
    },
    {
      q: "What guidelines are used for emergency funds and home down payments?",
      a: "We embed RBI regulations which recommend 3-6 months of expenses kept in high-liquidity instruments. For down payments, RBI dictates housing Loan-to-Value (LTV) limits of 75-90%, requiring a 10-25% out-of-pocket savings buffer."
    },
    {
      q: "What is the 100-minus-age rule and how is it used?",
      a: "It is a standard SEBI rule of thumb indicating equity allocation percentage (e.g. 70% for a 30-year-old). We use this along with SEBI risk-o-meter details in the RAG Chat to audit your asset configuration p.a."
    },
    {
      q: "How does the optimizer generate alternate plans?",
      a: "Plan A calculates conflicts under your current path. Plan B resolves conflicts by pushing Medium-priority goals by 2 years and Low-priority goals by 5 years. Plan C trims expenses to increase monthly savings by 25% to hit all goals on time."
    }
  ];

  return (
    <main className="min-h-screen relative bg-[#09090b] text-[#fafafa] flex flex-col justify-between overflow-x-hidden selection:bg-white selection:text-black font-sans">
      {/* Background Ambient Colored Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-[100px] pointer-events-none opacity-80" />
      <div className="absolute top-[20%] right-[-150px] w-[500px] h-[500px] rounded-full bg-blue-500/12 blur-[110px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-100px] left-[15%] w-[450px] h-[450px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none opacity-70" />

      <AnimatePresence mode="wait">
        {!isCockpitOpen ? (
          /* ==============================================================
             1. LANDING PAGE
             ============================================================== */
          <motion.div
            key="landing-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1"
          >
            {/* Header */}
            <header className="sticky top-0 w-full z-50 bg-[#09090b]/85 backdrop-blur-md border-b border-zinc-900/80 transition-all duration-300">
              <div className="w-full max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2 font-mono tracking-wider font-semibold text-sm">
                  <div className="p-1 bg-white text-black rounded">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-white font-sans text-lg tracking-tight font-bold">FinSight 360</span>
                </div>

                <nav className="hidden md:flex gap-8 text-xs font-medium text-zinc-400">
                  <a href="#features" className="hover:text-white transition-colors duration-200">Core Features</a>
                  <a href="#teaser-calculator" className="hover:text-white transition-colors duration-200">Teaser Tool</a>
                  <a href="#faq" className="hover:text-white transition-colors duration-200">FAQ</a>
                </nav>

                <button
                  onClick={() => setIsCockpitOpen(true)}
                  className="px-4.5 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors duration-200 shadow-sm cursor-pointer"
                >
                  Launch App
                </button>
              </div>
            </header>

            {/* Hero */}
            <section className="relative w-full max-w-7xl mx-auto px-6 pt-20 pb-16 text-center z-10 flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6 max-w-4xl"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-850 bg-zinc-900/40 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                    Interactive Client-Side Engine Activated
                  </span>
                </div>

                <h1 className="text-4xl sm:text-7xl font-sans font-bold tracking-tight text-white leading-[1.05]">
                  Financial planning,<br />
                  <span className="bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-400 bg-clip-text text-transparent underline decoration-zinc-800 underline-offset-[12px]">
                    redefined.
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-zinc-450 max-w-xl mx-auto leading-relaxed pt-2">
                  The GenAI + RAG Financial Planner that compiles returns, stress-tests macroeconomic shocks, and maps goal conflicts sequentially in an elegant interactive dashboard.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
                  <button
                    onClick={() => setIsCockpitOpen(true)}
                    className="group w-full sm:w-auto px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    Launch Financial Cockpit
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-205" />
                  </button>
                  <a
                    href="#teaser-calculator"
                    className="w-full sm:w-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-medium border border-zinc-800 hover:border-zinc-700 rounded-lg text-sm transition-all duration-205 flex justify-center"
                  >
                    Try Compounding Teaser
                  </a>
                </div>
              </motion.div>
            </section>

            {/* Security bar */}
            <section className="w-full border-y border-zinc-900 py-10 bg-zinc-950/40 backdrop-blur-sm z-10">
              <div className="w-full max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-3 text-zinc-400 text-xs font-mono">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="uppercase tracking-widest text-[9px] font-bold">Regulation Compliance</span>
                  <span className="text-zinc-750">|</span>
                  <span className="text-zinc-500">RBI & SEBI Guidelines Standardized</span>
                </div>
                <div className="flex flex-wrap items-center gap-8 opacity-45 grayscale hover:opacity-80 transition-opacity duration-300">
                  <span className="font-semibold tracking-wider font-mono text-sm text-zinc-400">SEBI INTERMEDIARIES</span>
                  <span className="font-semibold tracking-wider font-mono text-sm text-zinc-400">RBI CREDIT POLICY</span>
                  <span className="font-semibold tracking-wider font-mono text-sm text-zinc-400">MUTUAL FUNDS SIP</span>
                </div>
              </div>
            </section>

            {/* Features bento */}
            <section id="features" className="w-full max-w-7xl mx-auto px-6 py-24 z-10 space-y-12">
              <div className="max-w-2xl text-left">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Premium Dashboard Cockpit</div>
                <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mt-2">
                  Stress-test shocks, compound trajectories.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="md:col-span-2 p-8 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between gap-6">
                  <div>
                    <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg w-fit">
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-white mt-4">Offline RAG Advisor Intel</h3>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-lg">
                      Ask regulatory compliance queries. The RAG engine fetches matched segments from SEBI guides (mutual funds risk scales) and RBI circulars (emergency buffers, loan LTV limits) offline instantly.
                    </p>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-zinc-300 font-medium">sebi_investor_edu.txt, rbi_guidelines.txt</span>
                    </div>
                    <span className="font-mono text-zinc-550">Vector Store Active</span>
                  </div>
                </div>

                <div className="p-8 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between gap-6">
                  <div>
                    <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg w-fit">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-white mt-4">Goal Conflict Deductions</h3>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                      Computes sequential cash outflows. Highlights years with deficit overlaps in soft red conflict areas directly on the timeline.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-450">Sequential Solving</span>
                  </div>
                </div>

                <div className="p-8 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between gap-6">
                  <div>
                    <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg w-fit">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-white mt-4">What-If Life Event Shocks</h3>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                      Stress test job losses (income breaks), salary hikes (multipliers), market crashes (investment drawdown), or inflation spikes. Trajectories animate instantly.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-semibold">
                    Instant recalculations
                  </div>
                </div>

                <div className="md:col-span-2 p-8 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800 transition-colors duration-300 flex flex-col justify-between gap-6">
                  <div>
                    <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg w-fit">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-white mt-4">Three-Way Plan Optimizations</h3>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-lg">
                      Generate Plan A (current inputs), Plan B (adjusted timelines of lower-priority goals: push +2 to +5 years), and Plan C (increase monthly savings by 25%). Recommends optimal paths immediately.
                    </p>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 text-xs font-medium">
                    <span>Recommends Plan C for Alex if Plan A fails</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Sandbox section */}
            <section id="teaser-calculator" className="w-full bg-zinc-950/40 border-y border-zinc-900 py-24 z-10">
              <div className="w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center text-left">
                <div className="space-y-6">
                  <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Interactive Calculator</div>
                  <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
                    Visualize capital growth instantly.
                  </h2>
                  <p className="text-sm text-zinc-450 leading-relaxed max-w-lg">
                    Adjust the sliders to see how your recurring contributions accumulate over long horizons. Compounding highlights why regular additions outperform waiting.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4 border-t border-zinc-900 pt-6 font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-550 uppercase block">Total Wealth</span>
                      <strong className="text-lg font-bold text-white block mt-1">₹{getTeaserWealth().toLocaleString("en-IN")}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-550 uppercase block">Total Invested</span>
                      <strong className="text-lg font-bold text-zinc-300 block mt-1">₹{getTeaserInvested().toLocaleString("en-IN")}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-550 uppercase block">Earnings</span>
                      <strong className="text-lg font-bold text-emerald-400 block mt-1">₹{getTeaserInterest().toLocaleString("en-IN")}</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e] p-6 space-y-6">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Compounding Parameters</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-2">
                        <span>Monthly Contribution:</span>
                        <span className="font-mono text-white">₹{teaserContribution.toLocaleString("en-IN")}</span>
                      </div>
                      <input
                        type="range"
                        min="5000"
                        max="100000"
                        step="5000"
                        value={teaserContribution}
                        onChange={(e) => setTeaserContribution(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-2">
                        <span>Expected Return (CAGR):</span>
                        <span className="font-mono text-white">{teaserReturnRate}% p.a.</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="18"
                        step="1"
                        value={teaserReturnRate}
                        onChange={(e) => setTeaserReturnRate(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-2">
                        <span>Timeline:</span>
                        <span className="font-mono text-white">{teaserYears} Years</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        step="5"
                        value={teaserYears}
                        onChange={(e) => setTeaserYears(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQs */}
            <section id="faq" className="w-full max-w-4xl mx-auto px-6 py-24 z-10 text-left space-y-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-center">
                Frequently Asked Questions
              </h2>

              <div className="space-y-4">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-zinc-900 bg-zinc-950/20 overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full px-5 py-4 flex justify-between items-center text-xs font-semibold text-white hover:bg-zinc-900/40 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="border-t border-zinc-900 bg-zinc-900/10 text-zinc-455 text-xs px-5 py-4 leading-relaxed"
                          >
                            {faq.a}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* CTA CTA */}
            <section className="w-full max-w-5xl mx-auto px-6 pb-24 z-10">
              <div className="rounded-2xl border border-zinc-850 bg-[#0c0c0e] p-8 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-zinc-900 via-white to-zinc-900 opacity-60" />
                
                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Ready to launch your cockpit?</h3>
                <p className="text-xs text-zinc-450 max-w-md mx-auto leading-relaxed">
                  Enter the dashboard cockpit to stress-test your savings targets, map goals, compare optimization tracks, and converse with the RAG financial advisor.
                </p>
                <button
                  onClick={() => setIsCockpitOpen(true)}
                  className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-lg text-sm transition-all duration-200 active:scale-95 shadow-md cursor-pointer"
                >
                  Enter Cockpit Console
                </button>
              </div>
            </section>

            {/* Footer */}
            <footer className="w-full border-t border-zinc-900 py-6 bg-zinc-950/80 text-center text-[10px] text-zinc-650 font-mono">
              &copy; {new Date().getFullYear()} FinSight 360 Inc. All rights reserved. SEC / SEBI Registered Intermediary Mock.
            </footer>
          </motion.div>
        ) : !isLoggedIn ? (
          <AuthGate
            onSuccess={(email) => {
              setIsLoggedIn(true);
              const name = localStorage.getItem("finsight360_user_name") || "Alex";
              setUserName(name);
            }}
          />
        ) : (
          /* ==============================================================
             2. THE COCKPIT DASHBOARD (ACTIVE COCKPIT VIEW)
             ============================================================== */
          <motion.div
            key="cockpit"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="flex flex-col flex-1"
          >
            {/* Navbar Integration */}
            <Navbar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasConflicts={hasConflicts}
              profileName={profile.user_id ? "Custom" : userName}
              onReset={handleResetData}
              onExit={() => {
                localStorage.removeItem("finsight360_logged_in");
                setIsLoggedIn(false);
              }}
              savingsVal={netMonthlySavings}
              bufferVal={emergencyBufferMonths}
            />

            {/* Main Cockpit Body Container */}
            <div className="w-full max-w-7xl mx-auto px-6 py-6 flex-1 flex flex-col">
              
              <AnimatePresence mode="wait">
                
                {/* A. TAB OVERVIEW */}
                {activeTab === "Overview" && (
                  <motion.div
                    key="tab-overview"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-6"
                  >
                    {/* Row of Four Overview Cards (Image 1 layout) */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-left">
                      {/* Ending Wealth */}
                      <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-5 space-y-2">
                        <div className="text-[9px] font-mono font-bold text-zinc-555 uppercase tracking-wider">
                          ENDING WEALTH (30-YR)
                        </div>
                        <strong className="text-2xl font-bold text-white block leading-none font-mono">
                          ₹{Math.round(planATrajectory[30]?.nominal_corpus ?? 3811708).toLocaleString("en-IN")}
                        </strong>
                        <span className="text-[10px] text-zinc-500 block">
                          Compound target with expected return of {expectedReturn}%
                        </span>
                      </div>

                      {/* Savings Rate */}
                      <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-5 space-y-2">
                        <div className="text-[9px] font-mono font-bold text-zinc-550 uppercase tracking-wider">
                          MONTHLY SAVINGS RATE
                        </div>
                        <strong className="text-2xl font-bold text-white block leading-none font-mono">
                          ₹{netMonthlySavings.toLocaleString("en-IN")}
                        </strong>
                        <span className="text-[10px] text-zinc-500 block">
                          Savings rate of {monthlySavingsRate}% of income
                        </span>
                      </div>

                      {/* Emergency buffer */}
                      <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-5 space-y-2">
                        <div className="text-[9px] font-mono font-bold text-zinc-550 uppercase tracking-wider">
                          EMERGENCY CASH BUFFER
                        </div>
                        <strong className="text-2xl font-bold text-emerald-500 block leading-none font-mono">
                          {emergencyBufferMonths} Months
                        </strong>
                        <span className="text-[10px] text-zinc-500 block">
                          Recommended buffer is 6.0 Months (₹{(expenseInput * 6).toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                        </span>
                      </div>

                      {/* Feasibility Index */}
                      <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-5 space-y-2">
                        <div className="text-[9px] font-mono font-bold text-zinc-550 uppercase tracking-wider">
                          GOAL FEASIBILITY INDEX
                        </div>
                        <strong className="text-2xl font-bold text-yellow-500 block leading-none font-mono">
                          {getFeasibilityIndex()}%
                        </strong>
                        <span className="text-[10px] text-zinc-500 block">
                          Checks funding safety for {goals.length} target goals
                        </span>
                      </div>
                    </div>

                    {/* Chart Container (Spans full width) */}
                    <div className="w-full">
                      <GoalFundingChart
                        goals={goals}
                        currentSavings={profile.current_savings}
                        monthlySavings={netMonthlySavings}
                        expectedReturn={expectedReturn}
                        inflationRate={inflationRate}
                        currentYear={currentYear}
                      />
                    </div>

                    {/* Risk-Tailored Investment Strategy Card */}
                    <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-6 space-y-4 text-left">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            Risk-Tailored Investment Strategy & Asset Allocation
                          </h3>
                          <p className="text-xs text-zinc-450 mt-0.5">
                            Personalized investment portfolio recommendations based on your selected risk appetite ({riskInput} Risk).
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                          riskInput === "High" ? "bg-rose-950/40 border border-rose-900/40 text-rose-400" :
                          riskInput === "Medium" ? "bg-amber-950/40 border border-amber-900/40 text-amber-400" :
                          "bg-emerald-950/40 border border-emerald-900/40 text-emerald-400"
                        }`}>
                          {riskInput} RISK PROFILE
                        </span>
                      </div>

                      {/* Main Primary Recommendation: Mutual Funds */}
                      <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-4 space-y-2 text-left">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            📊 PRIMARY RECOMMENDATION: MUTUAL FUNDS
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[8px] font-mono font-bold uppercase">
                            RECOMMENDED
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white font-mono">
                          {riskInput === "Low" 
                            ? "Short-Duration Debt & Liquid Mutual Funds (Capital Preservation MFs)"
                            : riskInput === "Medium" 
                            ? "Flexi-Cap & Large-Cap Index Mutual Funds (Balanced Growth MFs)"
                            : "Mid-Cap & Small-Cap Equity Mutual Funds (Aggressive Growth MFs)"}
                        </div>
                        <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                          {riskInput === "Low"
                            ? "Focuses on high liquidity and capital safety with 80% allocation to AAA debt and G-Secs."
                            : riskInput === "Medium"
                            ? "Balances market upside and downside protection with 65% equity and 35% fixed-income allocation."
                            : "Maximizes long-term wealth compounding with 85% aggressive equity exposure across high-alpha mid-cap and small-cap opportunities."}
                        </p>
                      </div>

                      {/* Two Alternative Investment Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        {/* Option 1: Bonds */}
                        <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 space-y-2">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-550 block">
                            OPTION 1: FIXED INCOME BONDS
                          </span>
                          <div className="text-xs font-bold text-white font-mono">
                            {riskInput === "Low"
                              ? "Sovereign Gold Bonds (SGB) & G-Sec Sovereign Bonds"
                              : riskInput === "Medium"
                              ? "AAA-Rated Corporate Bonds & High-Yield PSU Debt Bonds"
                              : "High-Yield Convertible Bonds & Tax-Free Infra Bonds"}
                          </div>
                          <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                            {riskInput === "Low"
                              ? "Government-backed sovereign debt offering guaranteed capital protection and tax-exempt interest."
                              : riskInput === "Medium"
                              ? "High-grade corporate debentures providing stable predictable yield with minimal default risk."
                              : "Subordinated corporate debentures and high-coupon convertible bonds for maximum fixed-income returns with credit spread upside."}
                          </p>
                        </div>

                        {/* Option 2: Retirement / Real Estate / Tech */}
                        <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 space-y-2">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-550 block">
                            OPTION 2: RETIREMENT & DIVERSIFICATION
                          </span>
                          <div className="text-xs font-bold text-white font-mono">
                            {riskInput === "Low"
                              ? "Public Provident Fund (PPF) & Senior Citizens Savings Scheme"
                              : riskInput === "Medium"
                              ? "National Pension System (NPS Tier-I/II) & Gold ETFs"
                              : "Real Estate Investment Trusts (REITs) & Global Equity"}
                          </div>
                          <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                            {riskInput === "Low"
                              ? "EEE tax status scheme with guaranteed government annual compounding returns."
                              : riskInput === "Medium"
                              ? "Tax-efficient pension compounding across corporate and gilt asset classes."
                              : "Provides inflation-indexed commercial real estate rental yields + US tech equity market geographical diversification."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* B. TAB WHAT-IF SIMULATOR */}
                {activeTab === "What-If Simulator" && (
                  <motion.div
                    key="tab-simulator"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left"
                  >
                    <div className="lg:col-span-1">
                      <SimulatorControls
                        monthlyIncome={profile.monthly_income}
                        monthlyExpense={profile.monthly_expense}
                        currentSavings={profile.current_savings}
                        onScenarioChange={(type, params) => {
                          setSimScenarioType(type);
                          setSimScenarioParams(params);
                        }}
                      />
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                      {/* Grid of 3 Stressed Plans */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Stressed Plan A */}
                        <div className={`rounded-xl border p-5 flex flex-col justify-between min-h-[220px] bg-zinc-950/20 ${
                          (shockedPlanATrajectory[30]?.nominal_corpus ?? 0) > 0 
                            ? "border-zinc-900" 
                            : "border-rose-950/40"
                        }`}>
                          <div className="space-y-3">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[8px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                              Stressed Plan A
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-white">Current Habit Path</h4>
                              <span className="text-[10px] text-zinc-550 block font-mono">Baseline Track under Shock</span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">STRESSED END ASSETS</span>
                              <strong className={`text-xl font-mono font-bold block leading-none ${
                                (shockedPlanATrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-white" : "text-rose-500"
                              }`}>
                                ₹{Math.round(shockedPlanATrajectory[30]?.nominal_corpus ?? 0).toLocaleString("en-IN")}
                              </strong>
                            </div>

                            <div className="text-[10px] font-mono space-y-1 pt-1.5 border-t border-zinc-900">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Feasibility:</span>
                                <span className={(shockedPlanATrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                                  {(shockedPlanATrajectory[30]?.nominal_corpus ?? 0) > 0 ? "Resilient ✓" : "Deficit ⚠️"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Shock Loss:</span>
                                <span className="text-rose-400/80">
                                  -₹{Math.round(Math.max(0, (planATrajectory[30]?.nominal_corpus ?? 3811708) - (shockedPlanATrajectory[30]?.nominal_corpus ?? 0))).toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stressed Plan B */}
                        <div className={`rounded-xl border p-5 flex flex-col justify-between min-h-[220px] bg-zinc-950/20 ${
                          (shockedPlanBTrajectory[30]?.nominal_corpus ?? 0) > 0 
                            ? "border-zinc-900" 
                            : "border-rose-950/40"
                        }`}>
                          <div className="space-y-3">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[8px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                              Stressed Plan B
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-white">Adjusted Timelines</h4>
                              <span className="text-[10px] text-zinc-550 block font-mono">Deferred Goals under Shock</span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">STRESSED END ASSETS</span>
                              <strong className={`text-xl font-mono font-bold block leading-none ${
                                (shockedPlanBTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-white" : "text-rose-500"
                              }`}>
                                ₹{Math.round(shockedPlanBTrajectory[30]?.nominal_corpus ?? 0).toLocaleString("en-IN")}
                              </strong>
                            </div>

                            <div className="text-[10px] font-mono space-y-1 pt-1.5 border-t border-zinc-900">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Feasibility:</span>
                                <span className={(shockedPlanBTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                                  {(shockedPlanBTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "Resilient ✓" : "Deficit ⚠️"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Shock Loss:</span>
                                <span className="text-rose-400/80">
                                  -₹{Math.round(Math.max(0, (planBTrajectory[30]?.nominal_corpus ?? 3811708) - (shockedPlanBTrajectory[30]?.nominal_corpus ?? 0))).toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stressed Plan C */}
                        <div className={`rounded-xl border p-5 flex flex-col justify-between min-h-[220px] bg-zinc-950/20 ${
                          (shockedPlanCTrajectory[30]?.nominal_corpus ?? 0) > 0 
                            ? "border-emerald-950/40" 
                            : "border-rose-950/40"
                        }`}>
                          <div className="space-y-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                              Stressed Plan C
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-white">Accelerated Savings</h4>
                              <span className="text-[10px] text-zinc-550 block font-mono">Optimized track under Shock</span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">STRESSED END ASSETS</span>
                              <strong className={`text-xl font-mono font-bold block leading-none ${
                                (shockedPlanCTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-emerald-400" : "text-rose-500"
                              }`}>
                                ₹{Math.round(shockedPlanCTrajectory[30]?.nominal_corpus ?? 0).toLocaleString("en-IN")}
                              </strong>
                            </div>

                            <div className="text-[10px] font-mono space-y-1 pt-1.5 border-t border-zinc-900">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Feasibility:</span>
                                <span className={(shockedPlanCTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                                  {(shockedPlanCTrajectory[30]?.nominal_corpus ?? 0) > 0 ? "Resilient ✓" : "Deficit ⚠️"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Shock Loss:</span>
                                <span className="text-rose-400/80">
                                  -₹{Math.round(Math.max(0, (planCTrajectory[30]?.nominal_corpus ?? 5183923) - (shockedPlanCTrajectory[30]?.nominal_corpus ?? 0))).toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Info Panel explaining stress plans */}
                      <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e] p-5 text-xs text-zinc-400 space-y-3">
                        <div className="flex gap-2.5 items-start">
                          <Info className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-white font-mono uppercase text-[9px] tracking-wider block mb-1">STRESS PLAN ANALYSIS (GENAI ADVISOR)</span>
                            <p className="leading-relaxed whitespace-pre-wrap">
                              {isSimulating ? (
                                <span className="text-zinc-500 italic">Analyzing scenario via GenAI Advisor...</span>
                              ) : simAiResponse?.content ? (
                                simAiResponse.content
                              ) : (
                                "These 3 plans show how each option responds to the shocks applied via the sliders (e.g., job loss, salary growth fluctuations, or market crashes). They are calculated independently from your core comparison tracks."
                              )}
                            </p>
                          </div>
                        </div>

                        {simAiResponse?.sources && simAiResponse.sources.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-zinc-900 text-[10px] text-zinc-500 font-mono">
                            <span className="font-semibold text-white">Reference Sources:</span>
                            {simAiResponse.sources.map((s: any, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                                {s.source} (Page {s.page})
                              </span>
                            ))}
                          </div>
                        )}

                        {simAiResponse?.guardrail && (
                          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                            <span className="font-semibold text-white">Guardrail Status:</span>
                            <span className={simAiResponse.guardrail.valid ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                              {simAiResponse.guardrail.valid ? "✓ All LLM Numbers Verified" : "⚠️ Hallucination Alert: Discrepancy Found in Text"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* C. TAB ADVISOR & QUERIES */}
                {activeTab === "Advisor & Queries" && (
                  <motion.div
                    key="tab-rag"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <RagChat
                      monthlyIncome={profile.monthly_income}
                      monthlyExpense={profile.monthly_expense}
                      currentSavings={profile.current_savings}
                      age={profile.age}
                      riskTolerance={profile.risk_tolerance}
                      expectedReturn={expectedReturn}
                      inflationRate={inflationRate}
                    />
                  </motion.div>
                )}

                {/* D. TAB PLAN COMPARISON */}
                {activeTab === "Plan Comparison" && (
                  <motion.div
                    key="tab-comparison"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6 text-left"
                  >
                    {/* Heading Description */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                          PLAN COMPARISON DASHBOARD
                        </div>
                        <h3 className="text-xl font-bold text-white mt-1">Multi-scenario Plan Feasibility & Optimization</h3>
                        <p className="text-xs text-zinc-450 mt-1 max-w-4xl leading-relaxed">
                          Review three optimization scenarios generated by the financial core planner. Compare timeline adjustments versus increased savings rates.
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            const email = localStorage.getItem("finsight360_user_email") || "";
                            setIsGeneratingPlans(true);
                            setAiPlans(null);

                            fetch(`http://localhost:8000/api/v1/generate-plans?email=${email}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" }
                            })
                              .then(res => res.ok ? res.json() : null)
                              .then(data => { if (data) setAiPlans(data); })
                              .catch(err => console.warn("Failed to generate GenAI plans:", err))
                              .finally(() => setIsGeneratingPlans(false));
                          }}
                          disabled={isGeneratingPlans}
                          className="px-4 py-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-300 hover:text-emerald-200 rounded-lg text-xs font-mono font-bold transition-all shrink-0 uppercase tracking-wider cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingPlans ? "⏳ Optimizing..." : "⚡ Re-Optimize GenAI Strategy"}
                        </button>

                        <button
                          onClick={() => {
                            const anyCollapsed = !expandedPlanA || !expandedPlanB || !expandedPlanC;
                            setExpandedPlanA(anyCollapsed);
                            setExpandedPlanB(anyCollapsed);
                            setExpandedPlanC(anyCollapsed);
                          }}
                          className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-mono font-bold transition-all shrink-0 uppercase tracking-wider cursor-pointer active:scale-95 flex items-center gap-1.5"
                        >
                          {(!expandedPlanA || !expandedPlanB || !expandedPlanC) ? (
                            <>📂 Expand All Plans</>
                          ) : (
                            <>📁 Collapse All Plans</>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Side-by-Side comparison cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                         {/* Plan A Card */}
                      <div className={`rounded-xl border bg-[#0c0c0e]/40 p-6 flex flex-col justify-between transition-all duration-300 ${
                        expandedPlanA 
                          ? "border-rose-500/40 min-h-[380px]" 
                          : "border-zinc-900 hover:border-zinc-800 h-36"
                      }`}>
                        {expandedPlanA ? (
                          <>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 rounded bg-blue-950/20 border border-blue-900/30 text-[9px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                                  Baseline Path
                                </span>
                                <button onClick={() => setExpandedPlanA(false)} className="text-[10px] text-zinc-500 hover:text-white font-mono">✕ Collapse</button>
                              </div>

                              <div>
                                <h4 className="text-sm font-bold text-white">Plan A: Current Habit Path</h4>
                                <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                                  Maintain current income, expenditures, and original goal timelines.
                                </p>
                              </div>

                              {plans.PlanA.has_conflicts && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">OVERALL FEASIBILITY STATUS</span>
                                  <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                                    ⚠️ Goal Conflicts & Funding Deficits
                                  </span>
                                </div>
                              )}

                              {/* Goal-by-Goal Feasibility Breakdown */}
                              <div className="space-y-3 pt-2 border-t border-zinc-900">
                                <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">GOAL-BY-GOAL BREAKDOWN</span>
                                
                                {planAItems.length === 0 ? (
                                  <div className="text-[10px] text-zinc-500 italic">No active goals configured. Add target goals in the Profile & Goals tab.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {planAItems.map((item: any, idx: number) => {
                                      const yearsToGoal = item.years_remaining ?? Math.max(0, item.target_year - currentYear);

                                      return (
                                        <div key={`plana-g-${idx}`} className="rounded-lg border border-zinc-900 bg-zinc-950/60 p-3 text-[10px] space-y-1.5 font-mono">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-white text-xs">{item.goal_name || item.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                              item.feasible ? "bg-emerald-950/40 border border-emerald-900/40 text-emerald-400" : "bg-rose-950/40 border border-rose-900/40 text-rose-400"
                                            }`}>
                                              {item.feasible ? "Feasible ✓" : "Underfunded ⚠️"}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-1.5 pt-1.5 text-zinc-400 border-t border-zinc-900/60">
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Years to Goal</span>
                                              <span className="text-white font-semibold">{item.target_year} ({yearsToGoal} Yrs)</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Projected Money</span>
                                              <span className="text-emerald-400 font-semibold">₹{Math.round(item.projected_corpus).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Future Target Cost</span>
                                              <span className="text-zinc-300">₹{Math.round(item.future_cost).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Funding Gap</span>
                                              <span className={item.funding_gap > 0 ? "text-rose-400 font-bold" : "text-emerald-500 font-semibold"}>
                                                {item.funding_gap > 0 ? `-₹${Math.round(item.funding_gap).toLocaleString("en-IN")}` : "₹0 (Fully Covered)"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>


                              {/* GenAI Advisory Output */}
                              <div className="mt-3 rounded-lg border border-amber-900/20 bg-amber-950/10 p-3 text-[10px] text-amber-300/90 leading-relaxed">
                                <strong className="text-white block uppercase tracking-wider font-mono text-[9px] mb-1">💡 GenAI Advisory Insight</strong>
                                {aiPlans?.plans?.plan_a?.explanation || "Plan A maintains your current savings. Funding gaps occur when high-priority goals require capital faster than compounding permits."}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col justify-between h-full text-left">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-white">Plan A: Current Path</h4>
                              <span className="px-1.5 py-0.5 rounded bg-blue-950/20 border border-blue-900/30 text-[8px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                                Baseline
                              </span>
                            </div>
                            <button
                              onClick={() => setExpandedPlanA(true)}
                              className="w-full mt-4 text-center rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 py-2 text-xs text-zinc-300 hover:text-white font-semibold transition-all cursor-pointer"
                            >
                              Expand Full Plan A Breakdown
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Plan B Card */}
                      <div className={`rounded-xl border bg-[#0c0c0e]/40 p-6 flex flex-col justify-between transition-all duration-300 ${
                        expandedPlanB 
                          ? "border-amber-500/40 min-h-[380px]" 
                          : "border-zinc-900 hover:border-zinc-800 h-36"
                      }`}>
                        {expandedPlanB ? (
                          <>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 rounded bg-amber-950/20 border border-amber-900/30 text-[9px] font-bold text-amber-500 uppercase tracking-wider font-mono">
                                  Timeline Shifts
                                </span>
                                <button onClick={() => setExpandedPlanB(false)} className="text-[10px] text-zinc-500 hover:text-white font-mono">✕ Collapse</button>
                              </div>

                              <div>
                                <h4 className="text-sm font-bold text-white">Plan B: Adjusted Timelines</h4>
                                <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                                  Delay lower-priority target goals by a few years to optimize cash reserves.
                                </p>
                              </div>

                              {plans.PlanA.has_conflicts && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">OVERALL FEASIBILITY STATUS</span>
                                  {planBItems.every((it: any) => it.feasible) ? (
                                     <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                                       ✓ Feasible via Priority Timeline Shifts
                                     </span>
                                   ) : (
                                     <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                                       ⚠️ Capital Deficit Remains After Shifts
                                     </span>
                                   )}
                                </div>
                              )}

                              {/* Goal-by-Goal Feasibility Breakdown */}
                              <div className="space-y-3 pt-2 border-t border-zinc-900">
                                <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">GOAL-BY-GOAL BREAKDOWN</span>
                                
                                {planBItems.length === 0 ? (
                                  <div className="text-[10px] text-zinc-500 italic">No active goals configured.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {planBItems.map((item: any, idx: number) => {
                                      const originalGoal = goals.find(g => g.name === (item.goal_name || item.name));
                                      const priority = (originalGoal?.priority || "Medium").toLowerCase();
                                      const shiftYears = priority === "medium" ? 2 : priority === "low" ? 5 : 0;
                                      const yearsToGoal = item.years_remaining ?? Math.max(0, item.target_year - currentYear);

                                      return (
                                        <div key={`planb-g-${idx}`} className="rounded-lg border border-zinc-900 bg-zinc-950/60 p-3 text-[10px] space-y-1.5 font-mono">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-white text-xs">{item.goal_name || item.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                              item.feasible ? "bg-emerald-950/40 border border-emerald-900/40 text-emerald-400" : "bg-rose-950/40 border border-rose-900/40 text-rose-400"
                                            }`}>
                                              {item.feasible ? "Feasible ✓" : "Underfunded ⚠️"}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-1.5 pt-1.5 text-zinc-400 border-t border-zinc-900/60">
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Years to Goal</span>
                                              <span className="text-amber-400 font-semibold">{item.target_year} ({yearsToGoal} Yrs)</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Projected Money</span>
                                              <span className="text-emerald-400 font-semibold">₹{Math.round(item.projected_corpus).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Future Target Cost</span>
                                              <span className="text-zinc-300">₹{Math.round(item.future_cost).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Funding Gap</span>
                                              <span className={item.funding_gap > 0 ? "text-rose-400 font-bold" : "text-emerald-500 font-semibold"}>
                                                {item.funding_gap > 0 ? `-₹${Math.round(item.funding_gap).toLocaleString("en-IN")}` : "₹0 (Fully Covered)"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>


                              {/* GenAI Advisory Output */}
                              <div className="mt-3 rounded-lg border border-amber-900/20 bg-amber-950/10 p-3 text-[10px] text-amber-300/90 leading-relaxed">
                                <strong className="text-white block uppercase tracking-wider font-mono text-[9px] mb-1">💡 GenAI Advisory Insight</strong>
                                {aiPlans?.plans?.plan_b?.explanation || "By delaying lower-priority goals (Medium: +2 yrs, Low: +5 yrs), you allow your capital to compound longer, eliminating cash deficits."}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col justify-between h-full text-left">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-white">Plan B: Adjusted Timelines</h4>
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/20 border border-amber-900/30 text-[8px] font-bold text-amber-500 uppercase tracking-wider font-mono">
                                Shifted
                              </span>
                            </div>
                            <button
                              onClick={() => setExpandedPlanB(true)}
                              className="w-full mt-4 text-center rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 py-2 text-xs text-zinc-300 hover:text-white font-semibold transition-all cursor-pointer"
                            >
                              Expand Full Plan B Breakdown
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Plan C Card */}
                      <div className={`rounded-xl border bg-[#0c0c0e]/40 p-6 flex flex-col justify-between transition-all duration-300 ${
                        expandedPlanC 
                          ? "border-emerald-500 min-h-[380px]" 
                          : "border-zinc-900 hover:border-zinc-800 h-36"
                      }`}>
                        {expandedPlanC ? (
                          <>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                                  Recommended Plan
                                </span>
                                <button onClick={() => setExpandedPlanC(false)} className="text-[10px] text-zinc-500 hover:text-white font-mono">✕ Collapse</button>
                              </div>

                              <div>
                                <h4 className="text-sm font-bold text-white">Plan C: Accelerated Savings</h4>
                                <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                                  Accelerate savings rate to hit original target timelines without goal delays.
                                </p>
                              </div>

                              {plans.PlanA.has_conflicts && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">OVERALL FEASIBILITY STATUS</span>
                                  {planCItems.every((it: any) => it.feasible) ? (
                                    <span className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                                      ✓ Fully Feasible & Timelines Preserved
                                    </span>
                                  ) : (
                                    <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                                      ⚠️ Deficit Exceeds Max Savings Rate
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Goal-by-Goal Feasibility Breakdown */}
                              <div className="space-y-3 pt-2 border-t border-zinc-900">
                                <span className="text-[9px] text-zinc-550 block uppercase font-mono tracking-wider font-semibold">GOAL-BY-GOAL BREAKDOWN</span>
                                
                                {planCItems.length === 0 ? (
                                  <div className="text-[10px] text-zinc-500 italic">No active goals configured.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {planCItems.map((item: any, idx: number) => {
                                      const yearsToGoal = item.years_remaining ?? Math.max(0, item.target_year - currentYear);

                                      return (
                                        <div key={`planc-g-${idx}`} className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3 text-[10px] space-y-1.5 font-mono">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-white text-xs">{item.goal_name || item.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                              (item.feasible ?? true) ? "bg-emerald-950/40 border border-emerald-900/40 text-emerald-400" : "bg-rose-950/40 border border-rose-900/40 text-rose-400"
                                            }`}>
                                              {(item.feasible ?? true) ? "Feasible ✓" : "Underfunded ⚠️"}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-1.5 pt-1.5 text-zinc-400 border-t border-zinc-900/60">
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Years to Goal</span>
                                              <span className="text-emerald-400 font-semibold">{item.target_year} ({yearsToGoal} Yrs)</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Projected Money</span>
                                              <span className="text-emerald-400 font-semibold">₹{Math.round(item.projected_corpus).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Future Target Cost</span>
                                              <span className="text-zinc-300">₹{Math.round(item.future_cost).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                              <span className="text-zinc-550 block text-[8px] uppercase">Funding Gap</span>
                                              <span className="text-emerald-500 font-semibold">₹0 (Fully Covered)</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Required Savings Adjustments */}
                              <div className="space-y-2 pt-2 border-t border-zinc-900 text-[10px] font-mono">
                                <span className="text-[9px] text-zinc-550 block uppercase tracking-wider font-semibold">REQUIRED SAVINGS ADJUSTMENTS</span>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-zinc-400">
                                    <span>Additional Monthly Savings</span>
                                    <span className="text-emerald-500 font-bold">
                                      +₹{Math.max(0, Math.round((aiPlans?.finance_engine_output?.plans?.plan_c?.monthly_savings ?? plans.PlanC.monthly_savings) - netMonthlySavings)).toLocaleString("en-IN")}/mo
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-zinc-400">
                                    <span>Discretionary Expense Cut</span>
                                    <span className="text-rose-500 font-bold">
                                      -₹{Math.max(0, Math.round(expenseInput - (aiPlans?.finance_engine_output?.plans?.plan_c?.monthly_expense ?? plans.PlanC.monthly_expense))).toLocaleString("en-IN")}/mo
                                    </span>
                                  </div>
                                </div>
                              </div>


                              {/* GenAI Advisory Output */}
                              <div className="mt-3 rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-3 text-[10px] text-emerald-300 leading-relaxed">
                                <strong className="text-white block uppercase tracking-wider font-mono text-[9px] mb-1">❇️ GenAI Recommended Advisory</strong>
                                {aiPlans?.plans?.plan_c?.explanation || "Increases monthly savings by discretionary budget trims. This generates significantly higher compounding, leaving all target goals fully funded."}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col justify-between h-full text-left">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-white">Plan C: Accelerated Savings</h4>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                                Recommended
                              </span>
                            </div>
                            <button
                              onClick={() => setExpandedPlanC(true)}
                              className="w-full mt-4 text-center rounded border border-[#10b981]/50 bg-[#10b981]/10 hover:bg-[#10b981]/25 py-2 text-xs text-emerald-300 hover:text-white font-bold transition-all cursor-pointer"
                            >
                              Expand Full Plan C Breakdown
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* E. TAB PROFILE & GOALS */}
                {activeTab === "Profile & Goals" && (
                  <motion.div
                    key="tab-profile-goals"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-8 text-left"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Financial Profile Card */}
                    <div className="bg-cardBg border border-zinc-900 rounded-xl p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-white text-lg font-bold tracking-tight mb-1">Financial Profile Details</h3>
                        <p className="text-zinc-500 text-xs mb-6">Configure your foundational cash-flows, current savings, and market expectations.</p>
                        
                        <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Monthly Net Income (₹)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-zinc-650 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={incomeInput}
                                  onChange={(e) => setIncomeInput(Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pl-8 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Monthly Expenses (₹)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-zinc-650 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={expenseInput}
                                  onChange={(e) => setExpenseInput(Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pl-8 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Current Assets/Liquid Reserves (₹)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-zinc-650 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={savingsInput}
                                  onChange={(e) => setSavingsInput(Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pl-8 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Current Age (Years)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={ageInput}
                                  onChange={(e) => setAgeInput(Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Expected Return Rate (% p.a.)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={expectedReturn}
                                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pr-8 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                                <span className="absolute right-3.5 top-2.5 text-zinc-650 text-sm">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">Risk Tolerance</label>
                              <select
                                value={riskInput}
                                onChange={(e) => setRiskInput(e.target.value)}
                                className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 text-white text-sm focus:outline-none focus:border-zinc-750"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                              </select>
                            </div>
                          </div>

                          {/* Deficit Error Alert Banner */}
                          {expenseInput > incomeInput && (
                            <div className="mt-4 flex gap-3 rounded-lg border border-red-500/40 bg-red-950/30 p-3.5 text-xs text-red-400 font-mono items-center">
                              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 animate-pulse" />
                              <div>
                                <strong className="font-bold text-white block uppercase tracking-wider text-[10px]">
                                  ⚠️ Critical Deficit: Expenses Exceed Income
                                </strong>
                                Monthly expenses (₹{expenseInput.toLocaleString("en-IN")}) exceed income (₹{incomeInput.toLocaleString("en-IN")}) by ₹{(expenseInput - incomeInput).toLocaleString("en-IN")}/mo. You are operating at a net cash loss!
                              </div>
                            </div>
                          )}

                          {/* Savings Margin and savings rate badge */}
                          <div className={`bg-[#09090b] border rounded p-4 flex justify-between items-center mt-4 ${
                            expenseInput > incomeInput ? "border-red-900/50 bg-red-950/10" : "border-zinc-900"
                          }`}>
                            <span className="text-xs text-zinc-450 font-medium">
                              Monthly Savings Margin:{" "}
                              <strong className={expenseInput > incomeInput ? "text-rose-500 font-bold ml-1 font-mono" : "text-white ml-1 font-mono"}>
                                {expenseInput > incomeInput
                                  ? `-₹${(expenseInput - incomeInput).toLocaleString("en-IN")}`
                                  : `₹${(incomeInput - expenseInput).toLocaleString("en-IN")}`}
                              </strong>
                            </span>
                            <span className="text-xs text-zinc-450 font-medium">
                              Savings Rate:{" "}
                              <strong className={expenseInput > incomeInput ? "text-rose-500 font-bold ml-1 font-mono" : "text-emerald-400 ml-1 font-mono"}>
                                {expenseInput > incomeInput ? "0% (Deficit)" : `${Math.round(((incomeInput - expenseInput) / (incomeInput || 1)) * 100)}%`}
                              </strong>
                            </span>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-white text-black font-bold py-2.5 rounded hover:bg-zinc-200 active:scale-98 transition-all mt-4 text-sm cursor-pointer"
                          >
                            Update Profile Details
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Target Goals Card */}
                    <div className="bg-cardBg border border-zinc-900 rounded-xl p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-white text-lg font-bold tracking-tight mb-1">Financial Target Goals</h3>
                        <p className="text-zinc-500 text-xs mb-6">Add specific future expenses that require funding (e.g. buying a house, retirement).</p>

                        <form onSubmit={handleAddGoalSubmit} className="space-y-4 mb-6">
                          <div>
                            <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">GOAL DESCRIPTION</label>
                            <input
                              type="text"
                              value={newGoalName}
                              onChange={(e) => setNewGoalName(e.target.value)}
                              placeholder="e.g. Down payment on House"
                              className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 text-white text-sm focus:outline-none focus:border-zinc-750"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">TARGET AMOUNT (₹)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-zinc-650 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={newGoalAmount}
                                  onChange={(e) => setNewGoalAmount(e.target.value === "" ? "" : Number(e.target.value))}
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pl-8 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">TIME TO GOAL (YEARS)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-mono font-bold">Yrs</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="40"
                                  value={newGoalYears}
                                  onChange={(e) => setNewGoalYears(e.target.value === "" ? "" : Number(e.target.value))}
                                  placeholder="e.g. 5"
                                  className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 pl-12 pr-20 text-white text-sm focus:outline-none focus:border-zinc-750 font-mono"
                                />
                                <span className="absolute right-3.5 top-2.5 text-zinc-500 text-xs font-mono font-bold">
                                  ({currentYear + (Number(newGoalYears) || 0)})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">PRIORITY LEVEL</label>
                            <select
                              value={newGoalPriority}
                              onChange={(e) => setNewGoalPriority(e.target.value)}
                              className="w-full bg-[#09090b] border border-zinc-900 rounded p-2.5 text-white text-sm focus:outline-none focus:border-zinc-750"
                            >
                              <option value="High">High </option>
                              <option value="Medium">Medium </option>
                              <option value="Low">Low </option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-white text-black font-bold py-2.5 rounded hover:bg-zinc-200 active:scale-98 transition-all mt-4 text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Add Goal
                          </button>
                        </form>

                        {/* List of Goals */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {goals.map((g, i) => (
                            <div key={i} className="flex justify-between items-center rounded border border-zinc-900 bg-zinc-950/20 p-3 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-white">{g.name}</strong>
                                  {g.priority === "High" ? (
                                    <span className="text-[9px] font-bold text-rose-500 bg-rose-950/20 border border-rose-900/30 px-1.5 py-0.5 rounded uppercase font-mono select-none">
                                      High
                                    </span>
                                  ) : g.priority === "Medium" ? (
                                    <span className="text-[9px] font-bold text-amber-500 bg-amber-950/20 border border-amber-900/30 px-1.5 py-0.5 rounded uppercase font-mono select-none">
                                      Medium
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded uppercase font-mono select-none">
                                      Low
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                                  Target: ₹{g.target_amount.toLocaleString("en-IN")} in {g.target_year}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteGoal(i)}
                                className="text-zinc-650 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    </div>

                     {/* Generate Plan Button */}
                     <div className="flex justify-center pt-2 pb-8">
                       <button
                         onClick={async () => {
                           if (expenseInput > incomeInput) {
                             alert(`⚠️ Cannot Generate Plans:\n\nMonthly Expenses (₹${expenseInput.toLocaleString("en-IN")}) exceed Monthly Income (₹${incomeInput.toLocaleString("en-IN")}) by ₹${(expenseInput - incomeInput).toLocaleString("en-IN")}/month!\n\nPlease adjust your monthly expenses to a sustainable balance before generating optimization plans.`);
                             return;
                           }
                           const updated = {
                             ...profile,
                             age: ageInput,
                             risk_tolerance: riskInput,
                             monthly_income: incomeInput,
                             monthly_expense: expenseInput,
                             current_savings: savingsInput,
                           };
                           setProfile(updated);
                           saveState("finsight_profile_v2", updated);
                           localStorage.setItem("finsight_return_rate_v2", expectedReturn.toString());
                           localStorage.setItem("finsight_inflation_rate_v2", inflationRate.toString());
                           
                           const email = localStorage.getItem("finsight360_user_email") || "";
                           setIsGeneratingPlans(true);
                           
                           try {
                             // Step 1: Save profile to backend DB
                             await fetch(`http://localhost:8000/api/v1/profile?email=${email}`, {
                               method: "POST",
                               headers: { "Content-Type": "application/json" },
                               body: JSON.stringify(updated),
                             });
                             
                             // Step 2: Fetch AI/Core plans from backend
                             const res = await fetch(`http://localhost:8000/api/v1/generate-plans?email=${email}`, {
                               method: "POST"
                             });
                             if (res.ok) {
                               const data = await res.json();
                               setAiPlans(data);
                             }
                           } catch (err) {
                             console.error("Error generating plans:", err);
                           } finally {
                             setIsGeneratingPlans(false);
                             setExpandedPlanA(true);
                             setExpandedPlanB(true);
                             setExpandedPlanC(true);
                             setActiveTab("Plan Comparison");
                           }
                         }}
                         disabled={isGeneratingPlans}
                         className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer uppercase tracking-wider disabled:opacity-50"
                       >
                         <Sparkles className="w-4.5 h-4.5" /> {isGeneratingPlans ? "Optimizing via AI & Core..." : "Generate Comparison Plans"}
                       </button>
                     </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
            
            {/* Unified Dashboard Footer (Matching Image 4) */}
            <footer className="w-full border-t border-zinc-900 py-6 bg-[#09090b] text-[10px] text-zinc-600 font-mono mt-auto shrink-0 select-none">
              <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-2">
                <span>© {new Date().getFullYear()} FinSight 360. Compiled with Next.js, Framer Motion, and Tailwind CSS.</span>
                <span>SEC Sandbox compliance simulation index #44B-9028-EF9</span>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
