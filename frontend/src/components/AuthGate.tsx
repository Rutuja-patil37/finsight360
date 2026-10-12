"use client";

import React, { useState } from "react";
import { Mail, Lock, User, KeyRound, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthGateProps {
  onSuccess: (email: string) => void;
}

export default function AuthGate({ onSuccess }: AuthGateProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [loginName, setLoginName] = useState("Alex");

  const generateMockOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    return code;
  };

  const sendOtpEmail = async (targetEmail: string, code: string, isLogin: boolean) => {
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: targetEmail, otp: code }),
      });
      
      const data = await res.json();
      setIsLoading(false);

      if (res.ok) {
        setOtpSent(true);
        setIsUsingMock(false);
        setSuccessMsg(`A 6-digit ${isLogin ? "login" : "registration"} verification code has been sent to your email: ${targetEmail}.`);
      } else {
        // Fallback to simulated OTP if API key is not configured or fails
        setOtpSent(true);
        setIsUsingMock(true);
        setSuccessMsg(`Dev Mode Fallback: Server returned error: "${data.error || "Unknown"}". Using simulated OTP:`);
      }
    } catch (err: any) {
      setIsLoading(false);
      setOtpSent(true);
      setIsUsingMock(true);
      setSuccessMsg(`Dev Mode Fallback: Network failure. Using simulated OTP:`);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!email.trim() || !password.trim() || !name.trim()) {
      setErrorMsg("Please fill out all fields first.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify that email is unique
      const checkRes = await fetch("http://localhost:8000/api/v1/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();
      
      if (checkData.exists) {
        setErrorMsg("An account with this email already exists. Please choose a different email.");
        setIsLoading(false);
        return;
      }

      // 2. Email unique -> Send OTP
      const code = generateMockOtp();
      await sendOtpEmail(email, code, false);
    } catch (err) {
      setIsLoading(false);
      console.warn("FastAPI server check failed, falling back to offline OTP register:", err);
      const code = generateMockOtp();
      await sendOtpEmail(email, code, false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (enteredOtp !== generatedOtp) {
      setErrorMsg("Invalid verification code. Please check the OTP and try again.");
      return;
    }

    setIsLoading(true);

    if (activeTab === "register") {
      try {
        const regRes = await fetch("http://localhost:8000/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, password }),
        });
        
        setIsLoading(false);
        if (!regRes.ok) {
          const errData = await regRes.json();
          setErrorMsg(errData.detail || "Failed to register account in database.");
          return;
        }

        localStorage.setItem("finsight360_logged_in", "true");
        localStorage.setItem("finsight360_user_email", email);
        localStorage.setItem("finsight360_user_name", name);
        onSuccess(email);
      } catch (err) {
        setIsLoading(false);
        console.warn("FastAPI registration failed, completing offline register:", err);
        localStorage.setItem("finsight360_logged_in", "true");
        localStorage.setItem("finsight360_user_email", email);
        localStorage.setItem("finsight360_user_name", name);
        onSuccess(email);
      }
    } else {
      // Login flow complete
      setIsLoading(false);
      localStorage.setItem("finsight360_logged_in", "true");
      localStorage.setItem("finsight360_user_email", email);
      localStorage.setItem("finsight360_user_name", loginName);
      onSuccess(email);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify credentials against UserInfo database table
      const loginRes = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        const errData = await loginRes.json();
        setErrorMsg(errData.detail || "Invalid email or password.");
        setIsLoading(false);
        return;
      }

      const loginData = await loginRes.json();
      setLoginName(loginData.name || "Alex");

      // 2. Credentials match -> Send Login OTP
      const code = generateMockOtp();
      await sendOtpEmail(email, code, true);
    } catch (err) {
      setIsLoading(false);
      console.warn("FastAPI login failed, falling back to offline login:", err);
      setErrorMsg("Failed to connect to authentication server. Please ensure backend is running.");
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient glowing shapes */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-rose-500/5 blur-[150px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-[#0c0c0e]/85 border border-zinc-900 rounded-2xl p-8 shadow-2xl relative backdrop-blur-xl z-10 flex flex-col gap-6">
        
        {/* Brand logo header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-black shadow-lg shadow-emerald-500/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white mt-2">FinSight 360</h2>
          <p className="text-[10px] font-mono text-zinc-555 uppercase tracking-widest leading-none">
            GenAI + RAG Financial Cockpit
          </p>
        </div>

        {/* Tab switchers */}
        {!otpSent && (
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-lg border border-zinc-900">
            <button
              onClick={() => {
                setActiveTab("login");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`py-2 text-xs font-bold rounded transition-all duration-150 cursor-pointer ${
                activeTab === "login"
                  ? "bg-[#18181b] border border-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab("register");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`py-2 text-xs font-bold rounded transition-all duration-150 cursor-pointer ${
                activeTab === "register"
                  ? "bg-[#18181b] border border-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Notifications and Alerts */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-2 rounded-lg border border-rose-900/30 bg-rose-950/20 p-3 text-xs text-rose-500 font-semibold"
            >
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-3 text-xs text-emerald-400"
            >
              <div className="flex gap-2 font-semibold">
                <Sparkles className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
              {generatedOtp && isUsingMock && (
                <div className="mt-1 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 flex justify-between items-center font-mono">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Simulated Email OTP Code:</span>
                  <span className="text-sm text-emerald-400 font-black tracking-widest">{generatedOtp}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forms area */}
        <div className="text-left">
          {otpSent ? (
            /* ==================== OTP VERIFICATION FORM ==================== */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  ENTER EMAIL OTP CODE
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700 font-mono tracking-widest font-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : activeTab === "login" ? "Verify OTP & Log In" : "Verify OTP & Register"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const code = generateMockOtp();
                  await sendOtpEmail(email, code, activeTab === "login");
                }}
                disabled={isLoading}
                className="w-full text-center text-[10px] font-mono text-zinc-500 hover:text-white transition-colors py-1 cursor-pointer disabled:opacity-20"
              >
                Resend Verification OTP
              </button>
            </form>
          ) : activeTab === "login" ? (
            /* ==================== LOGIN FORM ==================== */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-white hover:bg-zinc-200 text-black font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Sending OTP..." : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ==================== REGISTER FORM ==================== */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  YOUR FULL NAME
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Sharma"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">
                  CHOOSE PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pl-10 text-white text-sm focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Sending Code..." : (
                  <>
                    <span>Send Verification OTP</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
