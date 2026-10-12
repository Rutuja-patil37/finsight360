"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Goal, TrajectoryPoint } from "@/lib/financialEngine";

interface ProjectionChartProps {
  goals: Goal[];
  currentYear: number;
  planA?: TrajectoryPoint[];
  planB?: TrajectoryPoint[];
  planC?: TrajectoryPoint[];
  activePlanId: "PlanA" | "PlanB" | "PlanC";
}

export default function ProjectionChart({
  goals,
  currentYear,
  planA = [],
  planB = [],
  planC = [],
  activePlanId,
}: ProjectionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(["PlanA", "PlanB", "PlanC"]);

  const togglePlan = (id: string) => {
    if (selectedPlanIds.includes(id)) {
      setSelectedPlanIds(selectedPlanIds.filter((p) => p !== id));
    } else {
      setSelectedPlanIds([...selectedPlanIds, id]);
    }
  };

  // Trajectories mapping matching Image 1 colors
  const trajectories = {
    PlanA: { points: planA, color: "#e4e4e7", name: "Plan A (Current)" }, // Zinc 200 (White-ish)
    PlanB: { points: planB, color: "#f97316", name: "Plan B (Delayed Goals)" }, // Orange 500
    PlanC: { points: planC, color: "#10b981", name: "Plan C (Optimized Savings)" }, // Emerald 500
  };

  // Core dimensions
  const svgWidth = 800;
  const svgHeight = 350;
  const padding = { top: 60, right: 30, bottom: 40, left: 70 };

  const getPointsCount = () => {
    return Math.max(planA.length, planB.length, planC.length);
  };
  const pointsCount = getPointsCount();
  const totalYears = pointsCount - 1;

  // Find max corpus value for scaling
  const getMaxCorpus = () => {
    let max = 1000000; // default min scale
    const checkMax = (points: TrajectoryPoint[]) => {
      points.forEach((p) => {
        if (p.nominal_corpus > max) max = p.nominal_corpus;
        if (p.real_corpus > max) max = p.real_corpus;
      });
    };
    if (selectedPlanIds.includes("PlanA")) checkMax(planA);
    if (selectedPlanIds.includes("PlanB")) checkMax(planB);
    if (selectedPlanIds.includes("PlanC")) checkMax(planC);
    return max * 1.02; // Tight margin
  };

  const maxCorpus = getMaxCorpus();

  // Helper to map trajectory coordinates
  const mapCoords = (index: number, value: number) => {
    if (pointsCount <= 1) return { x: padding.left, y: svgHeight - padding.bottom };
    const x = padding.left + (index / (pointsCount - 1)) * (svgWidth - padding.left - padding.right);
    const y = padding.top + (1 - value / maxCorpus) * (svgHeight - padding.top - padding.bottom);
    return { x, y };
  };

  // Generate SVG path string
  const getPathD = (points: TrajectoryPoint[]) => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => {
        const { x, y } = mapCoords(i, p.nominal_corpus);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  // Format INR Currency for Axis Labels (e.g. ₹9.2Cr)
  const formatAxisCurrency = (val: number) => {
    if (val === 0) return "₹0";
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(1)}Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(0)}L`;
    }
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Format INR for Tooltip (e.g. ₹38,11,708)
  const formatCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Handle Mouse Hover Tracker
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current || pointsCount <= 1) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * svgWidth;
    
    const chartWidth = svgWidth - padding.left - padding.right;
    const relativeX = mouseXInSvg - padding.left;
    const percent = Math.min(Math.max(relativeX / chartWidth, 0), 1);
    const index = Math.round(percent * (pointsCount - 1));
    
    setHoveredIndex(index);

    const tooltipX = padding.left + (index / (pointsCount - 1)) * chartWidth;
    setTooltipPos({ x: tooltipX, y: e.clientY - rect.top - 10 });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Draw Vertical lines for Goals
  const renderGoalMarkers = () => {
    return goals.map((goal, idx) => {
      const targetYearDiff = goal.target_year - currentYear;
      if (targetYearDiff < 0 || targetYearDiff >= pointsCount) return null;
      
      const { x } = mapCoords(targetYearDiff, 0);
      return (
        <g key={`goal-marker-${idx}`}>
          <line
            x1={x}
            y1={padding.top - 15}
            x2={x}
            y2={svgHeight - padding.bottom}
            stroke="#27272a" // zinc-800
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </g>
      );
    });
  };

  // Draw Y-Axis Grids and Labels (Inside grid matching screenshots)
  const renderYGrid = () => {
    const lines = 4;
    const elements = [];
    for (let i = 0; i <= lines; i++) {
      const val = (maxCorpus / lines) * i;
      const { y } = mapCoords(0, val);
      elements.push(
        <g key={`y-grid-${i}`}>
          <line
            x1={padding.left}
            y1={y}
            x2={svgWidth - padding.right}
            y2={y}
            stroke="#18181b" // zinc-900
            strokeWidth={1}
          />
          {i > 0 && (
            <text
              x={padding.left - 12}
              y={y + 4}
              textAnchor="end"
              fill="#52525b" // zinc-600
              className="text-[9px] font-mono"
            >
              {formatAxisCurrency(val)}
            </text>
          )}
        </g>
      );
    }
    return elements;
  };

  // Draw X-Axis ticks
  const renderXGrid = () => {
    const ticks = 6;
    const elements = [];
    for (let i = 0; i < ticks; i++) {
      const index = Math.round(((pointsCount - 1) / (ticks - 1)) * i);
      if (index >= pointsCount) continue;
      const yearVal = currentYear + index;
      const { x } = mapCoords(index, 0);
      
      elements.push(
        <g key={`x-grid-${i}`}>
          <text
            x={x}
            y={svgHeight - padding.bottom + 18}
            textAnchor="middle"
            fill="#52525b"
            className="text-[9px] font-mono"
          >
            {yearVal}
          </text>
        </g>
      );
    }
    return elements;
  };

  // Conflict zone highlight: where Plan A's corpus is 0 (dips below 0)
  const renderConflictZone = () => {
    const activePlanPoints = planA;
    if (activePlanPoints.length === 0) return null;

    const conflictRegions: { start: number; end: number }[] = [];
    let startIdx: number | null = null;

    activePlanPoints.forEach((p, idx) => {
      const isDeficit = p.nominal_corpus <= 0.1 && idx > 0;
      
      if (isDeficit && startIdx === null) {
        startIdx = idx - 1;
      } else if (!isDeficit && startIdx !== null) {
        conflictRegions.push({ start: startIdx, end: idx });
        startIdx = null;
      }
    });

    if (startIdx !== null) {
      conflictRegions.push({ start: startIdx, end: activePlanPoints.length - 1 });
    }

    return conflictRegions.map((region, idx) => {
      const points = [];
      for (let i = region.start; i <= region.end; i++) {
        points.push(mapCoords(i, 0));
      }
      for (let i = region.end; i >= region.start; i--) {
        points.push({ x: mapCoords(i, 0).x, y: svgHeight - padding.bottom });
      }

      const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <polygon
          key={`conflict-zone-${idx}`}
          points={pointsStr}
          fill="#ef4444"
          fillOpacity={0.06}
          stroke="#ef4444"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      );
    });
  };

  // Hover tracker rendering
  const renderHoverLine = () => {
    if (hoveredIndex === null) return null;
    const { x } = mapCoords(hoveredIndex, 0);
    return (
      <line
        x1={x}
        y1={padding.top}
        x2={x}
        y2={svgHeight - padding.bottom}
        stroke="#3f3f46"
        strokeWidth={1}
        strokeDasharray="2 2"
        pointerEvents="none"
      />
    );
  };

  const hoveredPoint = hoveredIndex !== null && trajectories[activePlanId]?.points[hoveredIndex] ? trajectories[activePlanId].points[hoveredIndex] : null;

  return (
    <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/40 p-6 text-left" ref={containerRef}>
      {/* Header controls */}
      <div className="flex flex-col justify-between border-b border-zinc-900/60 pb-5 md:flex-row md:items-end gap-4">
        <div>
          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
            ASSET PROJECTION MODEL
          </div>
          <h3 className="text-xl font-bold text-white mt-1.5 tracking-tight">30-Year Wealth Trajectory Comparison</h3>
        </div>

        {/* Legend buttons */}
        <div className="flex flex-wrap gap-4 text-xs">
          {Object.keys(trajectories).map((planKey) => {
            const key = planKey as "PlanA" | "PlanB" | "PlanC";
            const info = trajectories[key];
            const isSelected = selectedPlanIds.includes(key);
            return (
              <button
                key={key}
                onClick={() => togglePlan(key)}
                className={`flex items-center gap-2 font-mono text-[10px] transition-all duration-150 ${
                  isSelected ? "text-zinc-300 font-semibold" : "text-zinc-650 line-through opacity-40"
                }`}
              >
                <span
                  className="w-3 h-[2px] rounded-full inline-block"
                  style={{ backgroundColor: info.color }}
                />
                <span>{info.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative mt-6 h-64 w-full sm:h-72">
        <svg
          className="h-full w-full select-none"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y Axis Grid lines */}
          {renderYGrid()}

          {/* X Axis Grid lines */}
          {renderXGrid()}

          {/* Render Goal Markers */}
          {renderGoalMarkers()}

          {/* Render Conflict Zone Highlight */}
          {renderConflictZone()}

          {/* Render Plan Paths */}
          {Object.keys(trajectories).map((planKey) => {
            const key = planKey as "PlanA" | "PlanB" | "PlanC";
            const info = trajectories[key];
            if (!selectedPlanIds.includes(key)) return null;
            return (
              <motion.path
                key={key}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1, d: getPathD(info.points) }}
                transition={{ 
                  pathLength: { duration: 1.0, ease: "easeInOut" },
                  d: { duration: 0.45, ease: "easeInOut" }
                }}
                fill="none"
                stroke={info.color}
                strokeWidth={2.0}
              />
            );
          })}

          {/* Hover Line */}
          {renderHoverLine()}

          {/* Hover dots */}
          {hoveredIndex !== null &&
            Object.keys(trajectories).map((planKey) => {
              const key = planKey as "PlanA" | "PlanB" | "PlanC";
              const info = trajectories[key];
              if (!selectedPlanIds.includes(key) || info.points.length === 0) return null;
              const point = info.points[hoveredIndex];
              const { x, y } = mapCoords(hoveredIndex, point.nominal_corpus);
              return (
                <circle
                  key={`hover-dot-${key}`}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={info.color}
                  stroke="#09090b"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              );
            })}
        </svg>

        {/* Hover Tooltip HTML */}
        {hoveredIndex !== null && hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none rounded border border-zinc-800 bg-[#09090b]/95 p-3.5 shadow-xl text-left font-mono text-[10px]"
            style={{
              left: `${(tooltipPos.x / svgWidth) * 100}%`,
              top: `${Math.max(5, (tooltipPos.y / svgHeight) * 100 - 30)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-zinc-500 mb-2 uppercase">
              Year {hoveredPoint.year_index} ({currentYear + hoveredPoint.year_index})
            </div>
            <div className="space-y-1">
              {selectedPlanIds.includes("PlanC") && planC[hoveredIndex] && (
                <div className="flex items-center justify-between gap-4 text-emerald-400">
                  <span className="text-zinc-500 font-semibold">Plan C:</span>
                  <span>{formatCurrency(planC[hoveredIndex].nominal_corpus)}</span>
                </div>
              )}
              {selectedPlanIds.includes("PlanA") && planA[hoveredIndex] && (
                <div className="flex items-center justify-between gap-4 text-zinc-300">
                  <span className="text-zinc-500 font-semibold">Plan A:</span>
                  <span>{formatCurrency(planA[hoveredIndex].nominal_corpus)}</span>
                </div>
              )}
              {selectedPlanIds.includes("PlanB") && planB[hoveredIndex] && (
                <div className="flex items-center justify-between gap-4 text-orange-500">
                  <span className="text-zinc-500 font-semibold">Plan B:</span>
                  <span>{formatCurrency(planB[hoveredIndex].nominal_corpus)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between text-[9px] font-mono text-zinc-650">
        <span>Today ({currentYear})</span>
        <span>Year {Math.round(totalYears / 2)}</span>
        <span>Year {totalYears} ({currentYear + totalYears})</span>
      </div>
    </div>
  );
}
