export interface Goal {
  id?: number;
  name: string;
  target_amount: number;
  target_year: number;
  priority: string; // "High" | "Medium" | "Low"
}

export interface UserProfile {
  user_id?: number;
  age: number;
  monthly_income: number;
  monthly_expense: number;
  current_savings: number;
  risk_tolerance: string; // "Low" | "Medium" | "High"
}

export interface Transaction {
  id?: number;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  type: string; // "income" | "expense"
  description?: string;
}

export interface TrajectoryPoint {
  year_index: number;
  nominal_corpus: number;
  real_corpus: number;
  contributions_cumulative?: number;
  interest_earned?: number;
  annual_income?: number;
  annual_expense?: number;
}

export interface GoalStatus {
  name: string;
  target_year: number;
  priority: string;
  original_cost: number;
  future_cost: number;
  available_corpus_before: number;
  is_funded: boolean;
  deficit: number;
}

export interface Conflict {
  description: string;
  goal_name: string;
  deficit: number;
  priority: string;
  severity: "High" | "Medium" | "Low";
}

export interface Plan {
  name: string;
  has_conflicts: boolean;
  conflicts: Conflict[];
  goal_statuses: GoalStatus[];
  final_corpus: number;
  monthly_savings: number;
  monthly_expense: number;
}

export interface PlansResponse {
  PlanA: Plan;
  PlanB: Plan;
  PlanC: Plan;
  recommendation: {
    recommended_plan: string;
    notes: string;
  };
}

export interface SimulationResult {
  scenario_type: string;
  description: string;
  trajectory: TrajectoryPoint[];
}

export interface CategorySum {
  category: string;
  amount: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  savings: number;
}

export interface AnalysisResponse {
  total_income: number;
  total_expense: number;
  net_savings: number;
  savings_rate: number;
  top_expense_categories: CategorySum[];
  monthly_trends: MonthlyTrend[];
}

// ----------------------------------------------------
// CORE MATHEMATICAL FUNCTIONS
// ----------------------------------------------------

export function calculateFutureValue(
  principal: number,
  periodicAddition: number,
  annualRate: number,
  years: number
): number {
  const rate = annualRate / 100.0;
  if (rate === 0) {
    return principal + periodicAddition * years;
  }
  const fvPrincipal = principal * Math.pow(1 + rate, years);
  const fvAdditions = periodicAddition * ((Math.pow(1 + rate, years) - 1) / rate);
  return fvPrincipal + fvAdditions;
}

export function calculateInflationAdjustedAmount(
  amount: number,
  inflationRate: number,
  years: number
): number {
  const inf = inflationRate / 100.0;
  return amount * Math.pow(1 + inf, years);
}

export function projectCorpusTrajectory(
  initialCorpus: number,
  monthlySavings: number,
  growthRate: number,
  inflationRate: number,
  years: number
): TrajectoryPoint[] {
  const trajectory: TrajectoryPoint[] = [];
  let currentNominal = initialCorpus;
  const annualSavings = monthlySavings * 12.0;
  const rate = growthRate / 100.0;
  const inf = inflationRate / 100.0;

  // Year 0
  trajectory.push({
    year_index: 0,
    nominal_corpus: currentNominal,
    real_corpus: currentNominal,
    contributions_cumulative: 0.0,
    interest_earned: 0.0,
  });

  let cumulativeContributions = 0.0;

  for (let y = 1; y <= years; y++) {
    const interest = currentNominal * rate;
    currentNominal = currentNominal + interest + annualSavings;
    cumulativeContributions += annualSavings;

    // Real value is discounted back to Year 0 terms using cumulative inflation
    const realCorpus = currentNominal / Math.pow(1 + inf, y);

    trajectory.push({
      year_index: y,
      nominal_corpus: Math.round(currentNominal * 100) / 100,
      real_corpus: Math.round(realCorpus * 100) / 100,
      contributions_cumulative: Math.round(cumulativeContributions * 100) / 100,
      interest_earned: Math.round(interest * 100) / 100,
    });
  }

  return trajectory;
}

export function checkGoalFeasibility(
  initialCorpus: number,
  monthlySavings: number,
  growthRate: number,
  inflationRate: number,
  currentYear: number,
  goalName: string,
  goalTargetAmount: number,
  goalTargetYear: number
): {
  goal_name: string;
  target_year: number;
  years_remaining: number;
  original_cost: number;
  future_cost: number;
  projected_corpus: number;
  funding_gap: number;
  feasible: boolean;
} {
  let yearsRemaining = goalTargetYear - currentYear;
  if (yearsRemaining <= 0) {
    yearsRemaining = 0;
  }

  const annualSavings = monthlySavings * 12.0;

  // Cost of goal in future terms (nominal cost at target year)
  const futureGoalCost = calculateInflationAdjustedAmount(
    goalTargetAmount,
    inflationRate,
    yearsRemaining
  );

  // Projected corpus at the target year (if all savings are directed to it)
  const projectedCorpus = calculateFutureValue(
    initialCorpus,
    annualSavings,
    growthRate,
    yearsRemaining
  );

  const fundingGap = futureGoalCost - projectedCorpus;
  const feasible = fundingGap <= 0;

  return {
    goal_name: goalName,
    target_year: goalTargetYear,
    years_remaining: yearsRemaining,
    original_cost: Math.round(goalTargetAmount * 100) / 100,
    future_cost: Math.round(futureGoalCost * 100) / 100,
    projected_corpus: Math.round(projectedCorpus * 100) / 100,
    funding_gap: Math.round(Math.max(0.0, fundingGap) * 100) / 100,
    feasible: feasible,
  };
}

export function detectGoalConflicts(
  initialCorpus: number,
  monthlySavings: number,
  growthRate: number,
  inflationRate: number,
  currentYear: number,
  goals: Goal[]
): {
  has_conflicts: boolean;
  conflicts: Conflict[];
  final_corpus: number;
  goal_statuses: GoalStatus[];
} {
  if (!goals || goals.length === 0) {
    return {
      has_conflicts: false,
      conflicts: [],
      final_corpus: initialCorpus,
      goal_statuses: [],
    };
  }

  // Sanitize and sort goals by target year safely
  const sanitizedGoals = (goals || []).map((g) => {
    const rawYear = Number(g.target_year);
    const validYear = (!isNaN(rawYear) && rawYear > 0)
      ? (rawYear < currentYear ? currentYear + 1 : rawYear)
      : (currentYear + 5);
    const validAmount = (!isNaN(Number(g.target_amount))) ? Number(g.target_amount) : 0;
    return {
      ...g,
      name: g.name || "Target Goal",
      target_amount: validAmount,
      target_year: validYear,
      priority: g.priority || "Medium",
    };
  });

  const sortedGoals = [...sanitizedGoals].sort((a, b) => a.target_year - b.target_year);

  const conflicts: Conflict[] = [];
  const goalStatuses: GoalStatus[] = [];

  const rate = growthRate / 100.0;
  const annualSavings = monthlySavings * 12.0;

  let currentCorpus = initialCorpus;
  let lastYear = currentYear;

  for (const goal of sortedGoals) {
    const gYear = goal.target_year;
    const gName = goal.name;
    const gCost = goal.target_amount;
    const gPriority = goal.priority || "Medium";

    let yearsDiff = gYear - lastYear;
    if (yearsDiff < 0 || isNaN(yearsDiff)) {
      yearsDiff = 0;
    }

    // Grow the corpus over the yearsDiff
    for (let i = 0; i < yearsDiff; i++) {
      const interest = currentCorpus * rate;
      currentCorpus = currentCorpus + interest + annualSavings;
    }

    const durationYears = Math.max(0, gYear - currentYear);
    // Inflation-adjusted cost at the goal year
    const futureCost = calculateInflationAdjustedAmount(
      gCost,
      inflationRate,
      durationYears
    );

    // Deduct cost
    const availableBeforeDeduction = currentCorpus;
    currentCorpus -= futureCost;

    lastYear = gYear;

    const isFunded = currentCorpus >= 0;
    const deficit = isFunded ? 0.0 : Math.abs(currentCorpus);

    const safeFutureCost = isNaN(futureCost) ? gCost : futureCost;
    const safeAvailable = isNaN(availableBeforeDeduction) ? 0 : availableBeforeDeduction;
    const safeDeficit = isNaN(deficit) ? 0 : deficit;

    goalStatuses.push({
      name: gName,
      target_year: gYear,
      priority: gPriority,
      original_cost: gCost,
      future_cost: Math.round(safeFutureCost * 100) / 100,
      available_corpus_before: Math.round(safeAvailable * 100) / 100,
      is_funded: isFunded,
      deficit: Math.round(safeDeficit * 100) / 100,
    });

    if (!isFunded) {
      // Record a conflict
      conflicts.push({
        description: `Goal '${gName}' in ${gYear} creates a funding deficit of ₹${deficit.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
        goal_name: gName,
        deficit: Math.round(deficit * 100) / 100,
        priority: gPriority,
        severity: gPriority.toLowerCase() === "high" ? "High" : "Medium",
      });
      // Reset corpus to 0 (cannot spend negative money)
      currentCorpus = 0.0;
    }
  }

  return {
    has_conflicts: conflicts.length > 0,
    conflicts: conflicts,
    final_corpus: Math.round(currentCorpus * 100) / 100,
    goal_statuses: goalStatuses,
  };
}

export function generateAlternativePlans(
  initialCorpus: number,
  monthlyIncome: number,
  monthlyExpense: number,
  growthRate: number,
  inflationRate: number,
  currentYear: number,
  goals: Goal[]
): PlansResponse {
  const currentSavings = monthlyIncome - monthlyExpense;

  // 1. Plan A (Current Path)
  const planAResults = detectGoalConflicts(
    initialCorpus,
    currentSavings,
    growthRate,
    inflationRate,
    currentYear,
    goals
  );

  // 2. Plan B (Delayed Timelines)
  // Push Medium priority goals +2 years, Low priority goals +5 years
  const delayedGoals = goals.map((g) => {
    let newYear = g.target_year;
    const priority = (g.priority || "Medium").toLowerCase();
    if (priority === "medium") {
      newYear += 2;
    } else if (priority === "low") {
      newYear += 5;
    }
    return {
      ...g,
      target_year: newYear,
    };
  });

  const planBResults = detectGoalConflicts(
    initialCorpus,
    currentSavings,
    growthRate,
    inflationRate,
    currentYear,
    delayedGoals
  );

  // 3. Plan C (Increased Savings)
  // Target: Reduce expenses to increase monthly savings by 25%
  let increasedSavings = currentSavings * 1.25;
  // Ensure a minimum increase of 3000 (standard INR value, equivalent of 300 in template)
  const minIncrease = 3000;
  if (increasedSavings < currentSavings + minIncrease) {
    increasedSavings = currentSavings + minIncrease;
  }

  // Bound savings to not exceed 80% of income
  if (increasedSavings > monthlyIncome * 0.8) {
    increasedSavings = monthlyIncome * 0.8;
  }

  const suggestedExpense = monthlyIncome - increasedSavings;

  const planCResults = detectGoalConflicts(
    initialCorpus,
    increasedSavings,
    growthRate,
    inflationRate,
    currentYear,
    goals
  );

  // Recommendation logic
  let recommendedPlan = "Plan A";
  let recommendationNotes = "Your current plan is fully feasible. Keep up the good work!";

  if (planAResults.has_conflicts) {
    if (!planCResults.has_conflicts) {
      recommendedPlan = "Plan C";
      recommendationNotes = `We recommend Plan C. By increasing your monthly savings from ₹${currentSavings.toLocaleString(
        "en-IN",
        { maximumFractionDigits: 0 }
      )} to ₹${increasedSavings.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      })} (budgeting monthly expenses at ₹${suggestedExpense.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      })}), you can meet all your goals on time without delays.`;
    } else {
      recommendedPlan = "Plan B";
      recommendationNotes =
        "Since saving more alone cannot cover the gap, we recommend Plan B. Adjusting timelines by delaying Medium-priority goals by 2 years and Low-priority goals by 5 years allows your capital to compound longer, resolving conflicts.";
    }
  }

  return {
    PlanA: {
      name: "Current Track",
      has_conflicts: planAResults.has_conflicts,
      conflicts: planAResults.conflicts,
      goal_statuses: planAResults.goal_statuses,
      final_corpus: planAResults.final_corpus,
      monthly_savings: Math.round(currentSavings * 100) / 100,
      monthly_expense: Math.round(monthlyExpense * 100) / 100,
    },
    PlanB: {
      name: "Adjusted Timelines",
      has_conflicts: planBResults.has_conflicts,
      conflicts: planBResults.conflicts,
      goal_statuses: planBResults.goal_statuses,
      final_corpus: planBResults.final_corpus,
      monthly_savings: Math.round(currentSavings * 100) / 100,
      monthly_expense: Math.round(monthlyExpense * 100) / 100,
    },
    PlanC: {
      name: "Increased Savings / Cost Cut",
      has_conflicts: planCResults.has_conflicts,
      conflicts: planCResults.conflicts,
      goal_statuses: planCResults.goal_statuses,
      final_corpus: planCResults.final_corpus,
      monthly_savings: Math.round(increasedSavings * 100) / 100,
      monthly_expense: Math.round(suggestedExpense * 100) / 100,
    },
    recommendation: {
      recommended_plan: recommendedPlan,
      notes: recommendationNotes,
    },
  };
}

export function simulateScenario(
  profileIncome: number,
  profileExpense: number,
  initialCorpus: number,
  growthRate: number,
  inflationRate: number,
  currentYear: number,
  years: number,
  scenarioType: string, // "job_loss" | "salary_raise" | "market_crash" | "inflation_spike" | "none"
  scenarioParams: any
): SimulationResult {
  const trajectory: TrajectoryPoint[] = [];
  let currentNominal = initialCorpus;
  const rate = growthRate / 100.0;
  let inf = inflationRate / 100.0;

  // Base monthly income and expense
  const monthlyIncome = profileIncome;
  const monthlyExpense = profileExpense;

  trajectory.push({
    year_index: 0,
    nominal_corpus: Math.round(currentNominal * 100) / 100,
    real_corpus: Math.round(currentNominal * 100) / 100,
    annual_income: monthlyIncome * 12,
    annual_expense: monthlyExpense * 12,
  });

  let description = "";

  // Parse parameters
  const jobLossMonths = scenarioType === "job_loss" ? scenarioParams.months ?? 6 : 0;
  const jobLossYear = scenarioType === "job_loss" ? scenarioParams.year_index ?? 1 : 0;

  const isSalaryHike = scenarioType === "salary_hike" || scenarioType === "salary_raise";
  const raisePercent = isSalaryHike ? scenarioParams.percentage ?? 10 : 0;
  const raiseYear = isSalaryHike ? scenarioParams.year_index ?? 1 : 0;

  const crashPercent = scenarioType === "market_crash" ? scenarioParams.percentage ?? 20 : 0;
  const crashYear = scenarioType === "market_crash" ? scenarioParams.year_index ?? 1 : 0;

  if (scenarioType === "inflation_spike") {
    const newInflation = scenarioParams.new_inflation_rate ?? 8.0;
    inf = newInflation / 100.0;
    description = `Simulating permanent inflation spike to ${newInflation}%.`;
  } else if (scenarioType === "job_loss") {
    description = `Simulating job loss for ${jobLossMonths} months in Year ${jobLossYear}.`;
  } else if (isSalaryHike) {
    description = `Simulating a ${raisePercent}% salary raise starting in Year ${raiseYear}.`;
  } else if (scenarioType === "market_crash") {
    description = `Simulating a ${crashPercent}% market crash in Year ${crashYear}.`;
  } else {
    description = "Simulating current baseline trajectory with no major shocks.";
  }

  for (let y = 1; y <= years; y++) {
    let yearIncome = monthlyIncome * 12;
    let yearExpense = monthlyExpense * 12;

    // Apply salary raise
    if (isSalaryHike && y >= raiseYear) {
      yearIncome = monthlyIncome * (1 + raisePercent / 100.0) * 12;
    }

    // Apply job loss
    if (scenarioType === "job_loss" && y === jobLossYear) {
      const workingMonths = Math.max(0, 12 - jobLossMonths);
      yearIncome = monthlyIncome * workingMonths;
    }

    // Apply market crash
    if (scenarioType === "market_crash" && y === crashYear) {
      currentNominal = currentNominal * (1 - crashPercent / 100.0);
    }

    // Calculate interest on starting corpus
    const interest = currentNominal * rate;
    const annualSavings = yearIncome - yearExpense;
    currentNominal = currentNominal + interest + annualSavings;

    const realCorpus = currentNominal / Math.pow(1 + inf, y);

    trajectory.push({
      year_index: y,
      nominal_corpus: Math.round(currentNominal * 100) / 100,
      real_corpus: Math.round(realCorpus * 100) / 100,
      annual_income: Math.round(yearIncome * 100) / 100,
      annual_expense: Math.round(yearExpense * 100) / 100,
    });
  }

  return {
    scenario_type: scenarioType,
    description: description,
    trajectory: trajectory,
  };
}

export function analyzeCashFlow(
  transactions: Transaction[],
  profileIncome: number,
  profileExpense: number
): AnalysisResponse {
  if (!transactions || transactions.length === 0) {
    const savings = profileIncome - profileExpense;
    const savingsRate = profileIncome > 0 ? savings / profileIncome : 0.0;
    return {
      total_income: profileIncome,
      total_expense: profileExpense,
      net_savings: savings,
      savings_rate: savingsRate,
      top_expense_categories: [],
      monthly_trends: [],
    };
  }

  // Parse total income and expense
  let totalIncome = 0;
  let totalExpense = 0;

  const categoryMap: { [key: string]: number } = {};
  const monthlyMap: { [key: string]: { income: number; expense: number } } = {};

  for (const t of transactions) {
    const amount = Number(t.amount);
    const type = t.type.toLowerCase();
    const cat = t.category || "Other";

    if (type === "income") {
      totalIncome += amount;
    } else if (type === "expense") {
      totalExpense += amount;
      categoryMap[cat] = (categoryMap[cat] || 0) + amount;
    }

    // Group by month YYYY-MM
    // Assume date is in format YYYY-MM-DD
    const month = t.date.substring(0, 7) || "General";
    if (!monthlyMap[month]) {
      monthlyMap[month] = { income: 0, expense: 0 };
    }
    if (type === "income") {
      monthlyMap[month].income += amount;
    } else {
      monthlyMap[month].expense += amount;
    }
  }

  // Fallback to profile values if no transaction summaries exist
  if (totalIncome === 0) {
    totalIncome = profileIncome;
  }
  if (totalExpense === 0) {
    totalExpense = profileExpense;
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? netSavings / totalIncome : 0.0;

  // Format top expense categories
  const topExpenseCategories: CategorySum[] = Object.keys(categoryMap)
    .map((key) => ({
      category: key,
      amount: categoryMap[key],
    }))
    .sort((a, b) => b.amount - a.amount);

  // Format monthly trends
  const monthlyTrends: MonthlyTrend[] = Object.keys(monthlyMap)
    .map((key) => {
      const inc = monthlyMap[key].income;
      const exp = monthlyMap[key].expense;
      return {
        month: key,
        income: inc,
        expense: exp,
        savings: inc - exp,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    net_savings: netSavings,
    savings_rate: savingsRate,
    top_expense_categories: topExpenseCategories,
    monthly_trends: monthlyTrends,
  };
}
