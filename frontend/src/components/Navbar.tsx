"use client";

import React from "react";
import { 
  BarChart2, 
  Sliders, 
  MessageSquare, 
  Compass, 
  User, 
  Sparkles
} from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasConflicts: boolean;
  profileName: string;
  onReset: () => void;
  onExit: () => void;
  savingsVal?: number;
  bufferVal?: string;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  hasConflicts,
  profileName,
  onReset,
  onExit,
  savingsVal = 50000,
  bufferVal = "7.1"
}: NavbarProps) {
  
  const tabs = [
    { id: "Profile & Goals", icon: <User className="w-3.5 h-3.5" />, label: "Profile & Goals" },
    { id: "Plan Comparison", icon: <Compass className="w-3.5 h-3.5" />, label: "Plan Comparison" },
    { id: "Overview", icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Overview" },
    { id: "What-If Simulator", icon: <Sliders className="w-3.5 h-3.5" />, label: "What-If Simulator" },
    { id: "Advisor & Queries", icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Advisor & Queries" },
  ];

  return (
    <div className="w-full bg-[#09090b]">
      {/* Upper Header Row */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onExit}>
          <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-left">
            <h1 className="text-sm font-black tracking-tight text-white leading-none">FinSight 360</h1>
            <span className="text-[8px] font-bold tracking-wider text-zinc-500 uppercase leading-none block mt-0.5">
              GENAI + RAG FINANCIAL PLANNER
            </span>
          </div>
        </div>

        {/* Navigation Pills */}
        <nav className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded transition-all duration-150 ${
                  isActive 
                    ? "bg-[#18181b] border border-zinc-800 text-white" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {/* Red dot indicator */}
                {isActive && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Conflict Indicator & Logout */}
        <div className="flex items-center gap-3">
          {hasConflicts ? (
            <div className="flex items-center gap-1.5 rounded border border-rose-950/40 bg-rose-950/20 px-3 py-1.5 text-[9px] font-bold text-rose-500 tracking-wider uppercase select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Goal Conflicts Detected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded border border-emerald-950/40 bg-emerald-950/20 px-3 py-1.5 text-[9px] font-bold text-emerald-400 tracking-wider uppercase select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>No Conflicts Detected</span>
            </div>
          )}

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-850 active:scale-95 transition-all cursor-pointer font-mono uppercase tracking-wider"
          >
            Sign Out
          </button>
        </div>
      </header>
    </div>
  );
}
