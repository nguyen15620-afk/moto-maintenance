"use client";

import React, { useState } from "react";
import { Lock, Delete } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * PinLock — lớp khoá nhanh CỤC BỘ (lưu trong localStorage), KHÔNG thay thế
 * Supabase Auth. Mục đích: mở lại app nhanh trong vài giây (VD: đứng ở tiệm
 * sửa xe) mà không cần đăng nhập lại OTP mỗi lần, nhưng vẫn chặn người khác
 * cầm điện thoại xem được dữ liệu nếu bạn đã lỡ đăng nhập sẵn.
 *
 * Cách dùng: bọc quanh nội dung chính, ví dụ trong app/page.jsx:
 *   <PinLock>{children}</PinLock>
 */
export default function PinLock({ children }) {
  const savedPin = typeof window !== "undefined" ? localStorage.getItem("motocare_pin") : null;
  const [unlocked, setUnlocked] = useState(!savedPin);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  // Nếu user chưa từng thiết lập PIN, bỏ qua màn khoá — hiển thị app luôn
  if (!savedPin || unlocked) return children;

  function handleDigit(d) {
    vibrate(10);
    const next = (input + d).slice(0, 4);
    setInput(next);
    setError(false);
    if (next.length === 4) {
      if (next === savedPin) {
        vibrate([10, 30, 10]);
        setUnlocked(true);
      } else {
        vibrate(200);
        setError(true);
        setTimeout(() => setInput(""), 400);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-6">
      <Lock className="w-6 h-6 text-[var(--accent)] mb-4" />
      <p className="text-sm text-[var(--text-muted)] mb-5">Nhập mã PIN để mở MotoCare</p>

      <div className={`flex gap-3 mb-8 ${error ? "animate-pulse" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border ${
              i < input.length ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"
            } ${error ? "!bg-rose-500 !border-rose-500" : ""}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, idx) =>
          k === "" ? (
            <div key={idx} />
          ) : k === "del" ? (
            <button
              key={idx}
              onClick={() => {
                vibrate(10);
                setInput((s) => s.slice(0, -1));
              }}
              className="h-14 rounded-full flex items-center justify-center text-[var(--text-muted)]"
            >
              <Delete className="w-5 h-5" />
            </button>
          ) : (
            <button
              key={idx}
              onClick={() => handleDigit(k)}
              className="h-14 rounded-full bg-[var(--surface)] text-[var(--text)] text-xl font-medium active:scale-95 transition-transform"
            >
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** Gọi hàm này trong màn Cài đặt để bật/tắt khoá PIN */
export function setPin(pin) {
  if (pin && pin.length === 4) localStorage.setItem("motocare_pin", pin);
  else localStorage.removeItem("motocare_pin");
}