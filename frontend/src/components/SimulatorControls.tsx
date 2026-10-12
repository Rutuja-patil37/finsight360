"use client";

import React, { useState, useEffect } from "react";
import { AlertOctagon, ShieldAlert, Award, TrendingUp, AlertTriangle } from "lucide-react";

interface SimulatorControlsProps {
  monthlyIncome: number;
  monthlyExpense: number;
  currentSavings: number;
  onScenarioChange: (type: string, params: any) => void;
}

export default function SimulatorControls({
  monthlyIncome,
  monthlyExpense,
  currentSavings,
  onScenarioChange,
}: SimulatorControlsProps) {
  const [activeScenario, setActiveScenario] = useState<string>("job_loss");
  
  // Job Loss inputs
  const [jobLossMonths, setJobLossMonths] = useState<number>(4);
  const [jobLossYear, setJobLossYear] = useState<number>(1);
  
  // Salary Raise inputs
  const [salaryRaisePercent, setSalaryRaisePercent] = useState<number>(20);
  const [salaryRaiseYear, setSalaryRaiseYear] = useState<number>(2);
  
  // Market Crash inputs
  const [marketCrashPercent, setMarketCrashPercent] = useState<number>(25);
  const [marketCrashYear, setMarketCrashYear] = useState<number>(1);
  
  // Inflation Spike inputs
  const [inflationSpikeRate, setInflationSpikeRate] = useState<number>(8.0);

  // Trigger callback on state updates
  useEffect(() => {
    let params = {};
    if (activeScenario === "job_loss") {
      params = { months: jobLossMonths, year_index: jobLossYear };
    } else if (activeScenario === "salary_hike" || activeScenario === "salary_raise") {
      params = { percentage: salaryRaisePercent, year_index: salaryRaiseYear };
    } else if (activeScenario === "market_crash") {
      params = { percentage: marketCrashPercent, year_index: marketCrashYear };
    } else if (activeScenario === "inflation_spike") {
      params = { new_inflation_rate: inflationSpikeRate };
    } else {
      params = {};
    }
    onScenarioChange(activeScenario, params);
  }, [
    activeScenario,
    jobLossMonths,
    jobLossYear,
    salaryRaisePercent,
    salaryRaiseYear,
    marketCrashPercent,
    marketCrashYear,
    inflationSpikeRate,
  ]);

  // Alert generation logic
  const renderAlert = () => {
    if (activeScenario === "job_loss") {
      const bufferMonths = monthlyExpense > 0 ? currentSavings / monthlyExpense : 0;
      if (jobLossMonths > bufferMonths) {
        const exhaustionMonth = Math.floor(bufferMonths);
        return (
          <div className="flex gap-3 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-400">
            <ShieldAlert className="h-5.5 w-5.5 shrink-0 text-red-500 animate-pulse" />
            <div>
              <strong className="font-bold text-white block mb-0.5">Critical Emergency Deficit</strong>
              A job loss of {jobLossMonths} months in Year {jobLossYear} exceeds your emergency fund buffer of {bufferMonths.toFixed(1)} months. Your liquid cash reserves will be completely exhausted in Month {exhaustionMonth + 1}!
            </div>
          </div>
        );
      } else {
        return (
          <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-400">
            <Award className="h-5.5 w-5.5 shrink-0 text-emerald-500" />
            <div>
              <strong className="font-bold text-white block mb-0.5">Emergency Buffer Resilient</strong>
              Your current savings of ₹{currentSavings.toLocaleString("en-IN")} provides a {bufferMonths.toFixed(1)} months buffer. You can absorb a {jobLossMonths}-month job loss in Year {jobLossYear} without depleting your capital base.
            </div>
          </div>
        );
      }
    }
    
    if (activeScenario === "salary_hike" || activeScenario === "salary_raise") {
      const boostAmount = monthlyIncome * (salaryRaisePercent / 100);
      return (
        <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-400">
          <TrendingUp className="h-5.5 w-5.5 shrink-0 text-emerald-500" />
          <div>
            <strong className="font-bold text-white block mb-0.5">Accelerated Wealth Compound</strong>
            A {salaryRaisePercent}% salary raise in Year {salaryRaiseYear} increases your monthly gross cash flow by ₹{boostAmount.toLocaleString("en-IN")}. This will significantly accelerate compounding, helping you reach your target goals much earlier than planned.
          </div>
        </div>
      );
    }
    
    if (activeScenario === "market_crash") {
      const lossAmount = currentSavings * (marketCrashPercent / 100);
      return (
        <div className="flex gap-3 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-400">
          <AlertOctagon className="h-5.5 w-5.5 shrink-0 text-red-500" />
          <div>
            <strong className="font-bold text-white block mb-0.5">Market Drawdown Capital Hit</strong>
            A {marketCrashPercent}% market crash in Year {marketCrashYear} immediately wipes out ₹{lossAmount.toLocaleString("en-IN")} of your accumulated savings. To recover this loss, your portfolio will require a subsequent return of {((1 / (1 - marketCrashPercent / 100) - 1) * 100).toFixed(1)}% to break even.
          </div>
        </div>
      );
    }
    
    if (activeScenario === "inflation_spike") {
      if (inflationSpikeRate >= 7.0) {
        return (
          <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-4 text-xs text-yellow-400">
            <AlertTriangle className="h-5.5 w-5.5 shrink-0 text-yellow-500" />
            <div>
              <strong className="font-bold text-white block mb-0.5">Erosion of Real Purchasing Power</strong>
              A permanent inflation spike to {inflationSpikeRate}% drastically increases the nominal future cost of your goals. Over 15 years, a ₹10,00,000 cost will inflate to ₹{Math.round(1000000 * Math.pow(1 + inflationSpikeRate / 100, 15)).toLocaleString("en-IN")}, requiring a much larger target corpus.
            </div>
          </div>
        );
      }
    }
    
    return null;
  };

  const scenarios = [
    { id: "job_loss", name: "Job Loss Shock" },
    { id: "salary_hike", name: "Salary Growth" },
    { id: "market_crash", name: "Market Shock" },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-900 bg-[#0c0c0e] p-6 text-left">
      <div>
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          What-if simulator
        </div>
        <h3 className="text-lg font-bold text-white mt-1">Stress Test Scenarios</h3>
        <p className="text-xs text-zinc-400 mt-1">
          Apply macroeconomic shocks or life events to see their immediate impact on your savings.
        </p>
      </div>

      {/* Scenario buttons */}
      <div className="flex flex-wrap gap-2.5">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveScenario(s.id)}
            className={`rounded px-3.5 py-2 text-xs font-semibold border transition-all duration-200 ${
              activeScenario === s.id
                ? "bg-white text-black border-white"
                : "bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Inputs controls based on active scenario */}
      <div className="min-h-[140px] space-y-5 rounded-lg border border-zinc-900 bg-zinc-950/40 p-5">
        {activeScenario === "job_loss" && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-2">
                <span>Job Loss Duration:</span>
                <span className="font-mono text-white">{jobLossMonths} Months</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={jobLossMonths}
                onChange={(e) => setJobLossMonths(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>1 Month</span>
                <span>6 Months</span>
              </div>
            </div>
          </div>
        )}

        {(activeScenario === "salary_hike" || activeScenario === "salary_raise") && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-2">
                <span>Salary Hike:</span>
                <span className="font-mono text-white">+{salaryRaisePercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={salaryRaisePercent}
                onChange={(e) => setSalaryRaisePercent(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>+10%</span>
                <span>+50%</span>
              </div>
            </div>
          </div>
        )}

        {activeScenario === "market_crash" && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-2">
                <span>Market Drawdown:</span>
                <span className="font-mono text-white">-{marketCrashPercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                step="5"
                value={marketCrashPercent}
                onChange={(e) => setMarketCrashPercent(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>-10%</span>
                <span>-30%</span>
              </div>
            </div>
          </div>
        )}

        {activeScenario === "inflation_spike" && (
          <div>
            <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-2">
              <span>Inflation Rate:</span>
              <span className="font-mono text-white">{inflationSpikeRate}% p.a.</span>
            </div>
            <input
              type="range"
              min="4.0"
              max="8.0"
              step="0.5"
              value={inflationSpikeRate}
              onChange={(e) => setInflationSpikeRate(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
              <span>4.0%</span>
              <span>8.0%</span>
            </div>
          </div>
        )}

        {activeScenario === "none" && (
          <div className="flex h-full items-center justify-center py-6 text-zinc-500 text-xs font-medium">
            No stressors applied. Viewing normal compounding trajectory.
          </div>
        )}
      </div>

      {/* Actionable alerts based on math */}
      {renderAlert()}
    </div>
  );
}
