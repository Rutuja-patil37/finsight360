"use client";

import React from "react";
import { Goal } from "@/lib/financialEngine";
import { motion } from "framer-motion";

interface GoalFundingChartProps {
  goals: Goal[];
  currentSavings: number;
  monthlySavings: number;
  expectedReturn: number;
  inflationRate: number;
  currentYear: number;
}

export default function GoalFundingChart({
  goals,
  currentSavings,
  monthlySavings,
  expectedReturn,
  inflationRate,
  currentYear,
}: GoalFundingChartProps) {
  // 1. Calculate sequential available reserves vs inflated cost per goal
  const rate = expectedReturn / 100;
  const inf = inflationRate / 100;
  const annualSavings = monthlySavings * 12;
  const sortedGoals = [...goals].sort((a, b) => a.target_year - b.target_year);

  let corpus = currentSavings;
  let lastYear = currentYear;

  const data = sortedGoals.map((g) => {
    const yearsDiff = g.target_year - lastYear;
    if (yearsDiff > 0) {
      for (let i = 0; i < yearsDiff; i++) {
        corpus = corpus * (1 + rate) + annualSavings;
      }
    }
    const futureCost = g.target_amount * Math.pow(1 + inf, g.target_year - currentYear);
    const available = corpus;

    // Deduct cost and floor corpus at 0
    corpus -= futureCost;
    if (corpus < 0) corpus = 0;

    lastYear = g.target_year;

    const gap = Math.max(0, futureCost - available);
    const pct = futureCost > 0 ? Math.min(100, Math.max(0, (available / futureCost) * 100)) : 100;

    return {
      name: g.name,
      year: g.target_year,
      futureCost,
      available,
      gap,
      pct,
      feasible: available >= futureCost,
    };
  });

  // Formatting helpers
  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)}Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  // SVG parameters
  const svgWidth = 800;
  const svgHeight = 280;
  const padding = { top: 40, right: 30, bottom: 40, left: 70 };
  const chartHeight = svgHeight - padding.top - padding.bottom;
  const chartWidth = svgWidth - padding.left - padding.right;

  // Find max value for scaling the bars
  const maxVal = Math.max(
    100000,
    ...data.flatMap((d) => [d.futureCost, d.available])
  ) * 1.1; // Add padding

  return (
    <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-6 text-left space-y-6">
      <div>
        <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
          GOAL FUNDING DIAGRAM
        </div>
        <h3 className="text-xl font-bold text-white mt-1.5 tracking-tight">Goal-Specific Funding & Deficits</h3>
        <p className="text-xs text-zinc-450 mt-1">
          Compares inflated future cost target against projected available reserves at the target year under your current savings track.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-850 rounded text-zinc-550 text-xs font-mono">
          No active financial goals added. Add goals in Profile & Goals tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* SVG Bar Chart Visualizer (Span 2) */}
          <div className="lg:col-span-2 relative overflow-x-auto">
            <svg
              className="w-full min-w-[500px] select-none h-auto"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                const val = maxVal * r;
                const y = padding.top + chartHeight * (1 - r);
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="#18181b"
                      strokeWidth={1}
                    />
                    <text
                      x={padding.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      fill="#52525b"
                      className="text-[9px] font-mono"
                    >
                      {formatCurrency(val)}
                    </text>
                  </g>
                );
              })}

              {/* Draw Bars */}
              {data.map((d, i) => {
                // X coordinates
                const barSpacing = chartWidth / data.length;
                const groupX = padding.left + barSpacing * i + barSpacing * 0.15;
                const barWidth = barSpacing * 0.3;

                // Heights
                const targetH = (d.futureCost / maxVal) * chartHeight;
                const availH = (d.available / maxVal) * chartHeight;

                const targetY = padding.top + chartHeight - targetH;
                const availY = padding.top + chartHeight - availH;

                return (
                  <g key={i}>
                    {/* Target Required Bar (Zinc 800) */}
                    <rect
                      x={groupX}
                      y={targetY}
                      width={barWidth}
                      height={Math.max(2, targetH)}
                      fill="#27272a"
                      rx={2}
                    />

                    {/* Available Bar (Emerald if fully funded, Rose if gap) */}
                    <rect
                      x={groupX + barWidth + 8}
                      y={availY}
                      width={barWidth}
                      height={Math.max(2, availH)}
                      fill={d.feasible ? "#10b981" : "#ef4444"}
                      rx={2}
                    />

                    {/* Labels */}
                    <text
                      x={groupX + barWidth + 4}
                      y={svgHeight - padding.bottom + 18}
                      textAnchor="middle"
                      fill="#888888"
                      className="text-[10px] font-semibold"
                    >
                      {d.name.length > 18 ? d.name.substring(0, 16) + "..." : d.name}
                    </text>
                    <text
                      x={groupX + barWidth + 4}
                      y={svgHeight - padding.bottom + 30}
                      textAnchor="middle"
                      fill="#52525b"
                      className="text-[9px] font-mono"
                    >
                      ({d.year})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detailed Cards List (Span 1) */}
          <div className="space-y-4">
            {data.map((d, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 space-y-2 bg-zinc-950/20 ${
                  d.feasible ? "border-zinc-900" : "border-rose-950/30"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-white leading-none">{d.name}</h4>
                    <span className="text-[9px] font-mono text-zinc-550 block mt-1">Year {d.year}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                      d.feasible
                        ? "bg-emerald-950/30 border border-emerald-500/20 text-emerald-400"
                        : "bg-rose-950/30 border border-rose-950/30 text-rose-400"
                    }`}
                  >
                    {d.feasible ? "Funded" : "Gap"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-zinc-500">Funded Status:</span>
                    <span className={d.feasible ? "text-emerald-400" : "text-rose-400"}>
                      {d.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${d.feasible ? "bg-emerald-500" : "bg-rose-500"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.pct}%` }}
                      transition={{ duration: 1.0, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Status details */}
                <div className="text-[10px] font-mono space-y-1 pt-1.5 border-t border-zinc-900">
                  <div className="flex justify-between text-zinc-500">
                    <span>Future Cost:</span>
                    <span className="text-zinc-350">{formatCurrency(d.futureCost)}</span>
                  </div>
                  {d.gap > 0 && (
                    <div className="flex justify-between text-rose-500 font-bold">
                      <span>Deficit Gap:</span>
                      <span>{formatCurrency(d.gap)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
