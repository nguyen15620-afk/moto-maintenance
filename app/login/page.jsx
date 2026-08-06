"use client";

import React, { useState } from "react";
import { Bike, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { vibrate } from "@/lib/haptics";

export default function LoginPage() {
  const { signInWithOtp, verifyOtp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("email"); // email | otp
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Email hợp lệ mới cho bấm gửi mã — nút sẽ "sáng lên" (đổi từ mờ sang màu accent)
  const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
  const isValidOtp = otp.length === 6;

  async function handleSendOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithOtp(email);
      vibrate(15);
      setStep("otp");
    } catch (err) {
      setError("Không gửi được mã. Kiểm tra lại email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyOtp(email, otp);
      vibrate([10, 30, 10]);
      // AuthContext sẽ tự cập nhật session -> layout tự chuyển vào app
    } catch (err) {
      setError("Mã OTP không đúng hoặc đã hết hạn.");
      vibrate(200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
        <Bike className="w-7 h-7 text-[var(--accent)]" />
      </div>
      <h1 className="text-lg font-semibold text-[var(--text)] mb-1">MotoCare</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Đăng nhập để đồng bộ dữ liệu xe của bạn</p>

      <div className="w-full max-w-sm space-y-3">
        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-3.5 py-3">
              <Mail className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                placeholder="ban@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent w-full text-sm text-[var(--text)] focus:outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
            <button
              disabled={loading || !isValidEmail}
              className="w-full bg-[var(--accent)] disabled:opacity-30 disabled:grayscale text-[#04141a] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Gửi mã đăng nhập
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <p className="text-xs text-[var(--text-muted)] text-center">
              Đã gửi mã 6 số tới <span className="text-[var(--text)]">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full text-center tracking-[0.5em] text-2xl font-mono bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3.5 py-3 text-[var(--text)] focus:outline-none"
            />
            <button
              disabled={loading || !isValidOtp}
              className="w-full bg-[var(--accent)] disabled:opacity-30 disabled:grayscale text-[#04141a] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Xác nhận
            </button>
          </form>
        )}

        {error && <p className="text-xs text-rose-500 text-center">{error}</p>}

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[10px] text-[var(--text-muted)]">HOẶC</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-medium rounded-2xl py-3.5 active:scale-[0.98] transition-all"
        >
          Đăng nhập với Google
        </button>
      </div>
    </div>
  );
}