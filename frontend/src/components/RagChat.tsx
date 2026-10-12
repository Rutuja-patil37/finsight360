"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, FileText, ArrowUp, Plus } from "lucide-react";

interface RagChatProps {
  monthlyIncome: number;
  monthlyExpense: number;
  currentSavings: number;
  age: number;
  riskTolerance: string;
  expectedReturn: number;
  inflationRate: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  insight?: string;
  recommendation?: string;
  nextSteps?: string[];
  sources?: any[];
  guardrail?: any;
  whatIfNudge?: string;
}

export default function RagChat({
  monthlyIncome,
  monthlyExpense,
  currentSavings,
  age,
  riskTolerance,
  expectedReturn,
  inflationRate,
}: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Plan specific query helpers
  const [isPlanMenuOpen, setIsPlanMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const cached = localStorage.getItem("finsight_chat_history_v2");
    if (cached) {
      setMessages(JSON.parse(cached));
    } else {
      const welcome: Message = {
        role: "assistant",
        content: "Hello! I am your FinSight 360 AI Assistant. I can help analyze your goals, run optimizations, and answer questions backed by standard financial documents (SEBI, RBI guides, and the 50/30/20 rule). What financial questions can I help you answer today?",
      };
      setMessages([welcome]);
    }
  }, []);

  const saveHistory = (newMsgs: Message[]) => {
    localStorage.setItem("finsight_chat_history_v2", JSON.stringify(newMsgs));
  };

  // Mock semantic retrieval replies (updated with Plan A/B/C queries)
  const getAnswerAndContext = (query: string): { content: string; context: string } => {
    const q = query.toLowerCase();
    const buffer = monthlyExpense > 0 ? (currentSavings / monthlyExpense).toFixed(1) : "0.0";
    const savings = monthlyIncome - monthlyExpense;
    const rate = monthlyIncome > 0 ? Math.round((savings / monthlyIncome) * 100) : 0;

    // Plan A specific queries
    if (q.includes("query about plan a")) {
      return {
        content: `Regarding **Plan A (Current Track)**:
- Savings rate is ₹${savings.toLocaleString("en-IN")}/mo.
- Feasibility: **⚠️ Underfunded / Conflicts**.
- Key Conflict: Your Retirement Corpus goal in 2051 is at risk because sequential cash outflows for the Apartment down payment (2031) and Child's Higher Education (2041) deplete your reserves.
- Recommended fix: Increase monthly savings by **₹1,167** to clear all goal conflicts on this track.`,
        context: "financial_planning.txt [PLAN A]: Baseline savings (₹50k/mo) fails retirement target corpus due to sequential cash-out overlaps."
      };
    }

    // Plan B specific queries
    if (q.includes("query about plan b")) {
      return {
        content: `Regarding **Plan B (Adjusted Timelines)**:
- Savings rate remains at ₹${savings.toLocaleString("en-IN")}/mo.
- Feasibility: **✓ Feasible via Timeline Shifts**.
- Changes: Pushes the "Apartment Down Payment" (+2 Years) and "Child's Higher Education" (+2 Years).
- Rationale: By delaying these lower-priority goals, your money remains invested and compounds longer, securing high-priority goals (like Retirement) without needing larger savings.`,
        context: "financial_planning.txt [PLAN B]: Adjusting timelines by +2 years reduces cash outlays, securing high-priority goals sequentially."
      };
    }

    // Plan C specific queries
    if (q.includes("query about plan c")) {
      return {
        content: `Regarding **Plan C (Accelerated Savings)**:
- Savings rate is accelerated to **₹68,000/mo** (representing 57% savings rate).
- Feasibility: **✓ Fully Feasible & Optimized** (recommends leaving timelines original).
- Action required: Cuts discretionary expenses by **-₹7,000/mo** and adds **+₹18,000/mo** in savings.
- Output: Leaving you with **₹51,83,923** in ending wealth.`,
        context: "financial_planning.txt [PLAN C]: Increasing monthly savings by 25% resolves all goal conflicts and secures original timelines on time."
      };
    }

    if (q.includes("emergency") || q.includes("structure my emergency")) {
      return {
        content: `Based on the RBI guidelines, I recommend structuring your emergency fund as follows:

1. **Safety Size**: Hold **3 to 6 months** of living expenses. Your current monthly expenses are ₹${monthlyExpense.toLocaleString("en-IN")}, meaning a recommended buffer of ₹${(monthlyExpense * 6).toLocaleString("en-IN")} is ideal.
2. **Current Buffer**: Your liquid reserves of ₹${currentSavings.toLocaleString("en-IN")} represent **${buffer} months** of expenses, which is highly secure.
3. **Allocation**: Keep these in high-liquidity accounts or fixed deposits.`,
        context: "rbi_guidelines.txt [EMERGENCY FUNDS]: RBI recommends 3 to 6 months of expenses in liquid assets like sweep savings, fixed deposits, or liquid mutual funds."
      };
    }

    if (q.includes("goals") || q.includes("achieve my financial")) {
      return {
        content: `Based on your profile settings, you are currently compounding returns at **${expectedReturn}% p.a.** against a **${inflationRate}%** inflation drag:

- Your monthly savings rate is **${rate}%** (₹${savings.toLocaleString("en-IN")}/month).
- Under Plan A, your Retirement goal in 2051 is underfunded.
- To resolve this, you should adopt **Plan C**, which increases monthly contributions or trims discretionary spending to hit your target timelines on schedule.`,
        context: "financial_planning.txt [GOAL FEASIBILITY]: Short-term goals should remain in risk-free debt, while long-term allocations (7+ years) must maintain equity SIPs to compound above inflation."
      };
    }

    if (q.includes("sebi") || q.includes("investor education")) {
      return {
        content: `SEBI investor education guidelines focus on asset allocation and safety:

- **100-Minus-Age Rule**: Suggests equity allocation percentage should be 100 minus age (e.g. ${100 - age}% for you).
- **Risk Profiles**: Always consult the 'risk-o-meter' classifications of mutual fund schemes.
- **Intermediaries**: Execute transactions exclusively through SEBI-registered brokers.`,
        context: "sebi_investor_edu.txt [MUTUAL FUNDS & ASSET ALLOCATION]: Diversification across equities, debt, and gold reduces volatility. Equities outperform over 5+ year horizons."
      };
    }

    if (q.includes("50/30/20") || q.includes("50 / 30 / 20")) {
      return {
        content: `The **50/30/20 Rule** is a standard personal budgeting guide:

1. **50% Needs**: Essential bills, rent, and utility costs.
2. **30% Wants**: Discretionary expenses, travel, and leisure.
3. **20% Savings**: Wealth accumulation, debt payoffs, and SIPs.

For your monthly income of ₹${monthlyIncome.toLocaleString("en-IN")}, the target split is ₹${(monthlyIncome * 0.5).toLocaleString("en-IN")} for Needs, ₹${(monthlyIncome * 0.3).toLocaleString("en-IN")} for Wants, and ₹${(monthlyIncome * 0.2).toLocaleString("en-IN")} for Savings.`,
        context: "financial_planning.txt [50/30/20 BUDGETING RULE]: Split income into 50% Needs, 30% Wants, and 20% Savings."
      };
    }

    return {
      content: `I have matched your query to the financial databases.

- **Current Savings Rate**: ${rate}% of income (₹${savings.toLocaleString("en-IN")}/month).
- **Emergency cash buffer**: ${buffer} months.
- **Recommended Action**: Review your Plan Comparison tab to optimize your goal allocations.`,
      context: "financial_planning.txt [GOALS]: General planning rules recommend investing in diversified indices to mitigate risk."
    };
  };

  const typewriteResponse = (
    fullText: string,
    currentMessagesList: Message[],
    extra?: {
      insight?: string;
      recommendation?: string;
      nextSteps?: string[];
      sources?: any[];
      guardrail?: any;
      whatIfNudge?: string;
    }
  ) => {
    const placeholderMsgs: Message[] = [
      ...currentMessagesList,
      {
        role: "assistant",
        content: "",
        insight: extra?.insight,
        recommendation: extra?.recommendation,
        nextSteps: extra?.nextSteps,
        sources: extra?.sources,
        guardrail: extra?.guardrail,
        whatIfNudge: extra?.whatIfNudge,
      },
    ];
    setMessages(placeholderMsgs);

    let idx = 0;
    const interval = setInterval(() => {
      setMessages((prev) => {
        const list = [...prev];
        const last = list[list.length - 1];
        if (last && last.role === "assistant") {
          last.content = fullText.substring(0, idx + 1);
        }
        return list;
      });
      idx += 3;
      if (idx >= fullText.length) {
        clearInterval(interval);
        setMessages((final) => {
          saveHistory(final);
          return final;
        });
      }
    }, 15);
  };

  const handleClear = async () => {
    localStorage.removeItem("finsight_chat_history_v2");
    setMessages([{
      role: "assistant",
      content: "Hello! I am your FinSight 360 AI Assistant. I can help analyze your goals, run optimizations, and answer questions backed by standard financial documents (SEBI, RBI guides, and the 50/30/20 rule). What financial questions can I help you answer today?"
    }]);
    try {
      const email = localStorage.getItem("finsight360_user_email") || "";
      await fetch(`http://localhost:8000/api/v1/chat/history?email=${email}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend offline, cleared chat history locally only:", e);
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    let processedText = text;
    let displayUserText = text;
    if (selectedPlan && !text.startsWith("[Query about")) {
      processedText = `[Query about ${selectedPlan}] ${text}`;
      displayUserText = `[${selectedPlan}] ${text}`;
    }

    const newMsgs: Message[] = [...messages, { role: "user", content: displayUserText }];
    setMessages(newMsgs);
    setInputVal("");
    setIsTyping(true);

    const email = localStorage.getItem("finsight360_user_email") || "default_user@example.com";
    fetch(`http://localhost:8000/api/v1/chat?email=${email}&growth_rate=${expectedReturn}&inflation_rate=${inflationRate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: processedText })
    })
      .then(res => {
        if (!res.ok) throw new Error("FastAPI returned error");
        return res.json();
      })
      .then(data => {
        setIsTyping(false);
        setRetrievedContext(data.rag_context_used || "RAG Context retrieved from vector database.");
        typewriteResponse(data.response, newMsgs, {
          insight: data.insight,
          recommendation: data.recommendation,
          nextSteps: data.next_steps,
          sources: data.sources,
          guardrail: data.guardrail,
          whatIfNudge: data.what_if_nudge
        });
      })
      .catch(err => {
        console.warn("FastAPI chat server offline, falling back to client-side RAG engine:", err);
        const response = getAnswerAndContext(processedText);
        setIsTyping(false);
        setRetrievedContext(response.context);
        typewriteResponse(response.content, newMsgs);
      });
  };

  const suggestedQueries = [
    "Can I achieve my financial goals?",
    "How should I structure my emergency fund?",
    "Explain SEBI investor education rules.",
    "What is the 50/30/20 rule of saving?",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-210px)] min-h-[500px] text-left">
      {/* Active Chat Advisor Card (Span 2) */}
      <div className="lg:col-span-2 flex flex-col rounded-xl border border-zinc-900 bg-[#0c0c0e]/30 overflow-hidden relative">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold select-none">❇️</span>
            <h4 className="text-xs font-bold text-white tracking-wider uppercase font-mono">
              ACTIVE ADVISOR & QUERIES
            </h4>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleClear}
              className="text-[10px] text-zinc-500 hover:text-red-405 font-mono transition-colors uppercase border border-zinc-800 rounded px-2 py-0.5 cursor-pointer"
            >
              Clear Chat
            </button>
            <span className="text-[10px] text-zinc-650 font-mono">Knowledge Base: Active</span>
          </div>
        </div>

        {/* Chat Bubbles space */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((m, i) => {
            const isBot = m.role === "assistant";
            return (
              <div
                key={`msg-${i}`}
                className={`flex gap-3 max-w-[88%] ${isBot ? "self-start" : "ml-auto flex-row-reverse"}`}
              >
                {isBot ? (
                  <div className="rounded-xl border border-zinc-800 bg-[#161619]/60 px-4 py-3.5 text-xs text-zinc-300 leading-relaxed shadow-sm space-y-3 max-w-full">
                    <div className="whitespace-pre-wrap">
                      {m.content
                        ? m.content
                            .replace(/[\uF000-\uF8FF\u25A0-\u25FF]/g, "• ")
                            .replace(/(•\s*){2,}/g, "• ")
                            .trim()
                        : ""}
                    </div>

                    {/* Advisor Insight */}
                    {m.insight && (
                      <div className="rounded border border-amber-900/30 bg-amber-950/10 p-2.5 text-[11px] text-amber-400">
                        <strong className="text-white block mb-0.5 uppercase tracking-wider font-mono text-[9px]">💡 Advisor Insight</strong>
                        {m.insight}
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {m.recommendation && (
                      <div className="rounded border border-emerald-900/30 bg-emerald-950/10 p-2.5 text-[11px] text-emerald-400">
                        <strong className="text-white block mb-0.5 uppercase tracking-wider font-mono text-[9px]">❇️ Recommendation</strong>
                        {m.recommendation}
                      </div>
                    )}

                    {/* Next Steps */}
                    {m.nextSteps && m.nextSteps.length > 0 && (
                      <div className="rounded border border-zinc-800 bg-zinc-900/20 p-2.5 text-[11px] text-zinc-400">
                        <strong className="text-white block mb-1 uppercase tracking-wider font-mono text-[9px]">📋 Recommended Next Steps</strong>
                        <ul className="list-decimal list-inside space-y-0.5">
                          {m.nextSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Sources / Citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-zinc-900 text-[9px] text-zinc-550 font-mono">
                        <span className="mr-1">References:</span>
                        {m.sources.map((s: any, idx: number) => (
                          <span key={idx} className="px-1 border border-zinc-800 bg-zinc-950 rounded hover:text-white" title={`${s.source}`}>
                            {s.source.replace(".pdf", "")} (Pg {s.page})
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Guardrails Check */}
                    {m.guardrail && (
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono pt-1">
                        <span className={m.guardrail.valid ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                          {m.guardrail.valid ? "✓ Numbers Verified" : "⚠️ Numerical Discrepancy Caution"}
                        </span>
                        {m.guardrail.unverified_numbers && m.guardrail.unverified_numbers.length > 0 && (
                          <span className="text-[8px] text-zinc-650">
                            (Unverified: {m.guardrail.unverified_numbers.join(", ")})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-800 px-4 py-3 text-xs text-white leading-relaxed font-semibold">
                    <div>{m.content}</div>
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 self-start">
              <div className="rounded-xl border border-zinc-800 bg-[#161619]/60 px-4 py-3.5 text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "100ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "200ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Plan Query helper overlay */}
        {isPlanMenuOpen && (
          <div className="absolute bottom-[65px] left-4 z-30 w-80 rounded-lg border border-zinc-800 bg-[#09090b] p-4 shadow-2xl space-y-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <span className="font-mono font-bold text-zinc-455 tracking-wider text-[9px]">PLAN QUERY COMPANION</span>
              <button
                type="button"
                onClick={() => setIsPlanMenuOpen(false)}
                className="text-zinc-650 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-zinc-550 block uppercase text-[8px] tracking-wider font-mono">SELECT PLAN:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-white">
                  <input
                    type="radio"
                    name="queryPlan"
                    value="None"
                    checked={selectedPlan === null}
                    onChange={() => setSelectedPlan(null)}
                    className="accent-zinc-600"
                  />
                  <span>None</span>
                </label>
                {["Plan A", "Plan B", "Plan C"].map((p) => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-white">
                    <input
                      type="radio"
                      name="queryPlan"
                      value={p}
                      checked={selectedPlan === p}
                      onChange={() => setSelectedPlan(p)}
                      className="accent-emerald-500"
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputVal);
          }}
          className="flex border-t border-zinc-900 bg-[#09090b] p-3 mx-4 mb-4 rounded-lg border border-zinc-800/80 items-center justify-between relative"
        >
          <div className="flex items-center shrink-0">
            {/* Plus button to open plan query helper */}
            <button
              type="button"
              onClick={() => setIsPlanMenuOpen(!isPlanMenuOpen)}
              className="flex h-7.5 w-7.5 items-center justify-center rounded bg-zinc-900 border border-zinc-800 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-850 transition-all shrink-0 active:scale-95 cursor-pointer mr-2"
              title="Select plan context for query"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Selected Plan context badge */}
            {selectedPlan && (
              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono select-none mr-2 ${
                selectedPlan === "Plan A" 
                  ? "bg-rose-950/40 border border-rose-900/30 text-rose-400" 
                  : selectedPlan === "Plan B"
                  ? "bg-amber-950/40 border border-amber-900/30 text-amber-400"
                  : "bg-emerald-950/40 border border-emerald-900/30 text-emerald-400"
              }`}>
                {selectedPlan}
              </span>
            )}
          </div>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask a financial planning or regulation question..."
            className="flex-1 bg-transparent border-0 px-1 text-xs text-white placeholder-zinc-700 focus:ring-0 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isTyping}
            className="flex h-7.5 w-7.5 items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-20 transition-all shrink-0 active:scale-95 cursor-pointer"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Suggested Queries (Right column) */}
      <div className="flex flex-col gap-6">
        {/* Suggested Queries */}
        <div className="rounded-xl border border-zinc-900 bg-[#0c0c0e]/30 p-5 space-y-4 flex-1">
          <h4 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
            SUGGESTED QUERIES
          </h4>
          <div className="flex flex-col gap-2">
            {suggestedQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="w-full text-left rounded border border-zinc-900 hover:border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/40 px-3.5 py-3 text-xs text-zinc-400 hover:text-zinc-200 transition-all duration-150 active:scale-[0.99] font-medium"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
