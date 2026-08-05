"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

/**
 * Bọc toàn bộ app trong <AuthProvider> (đặt trong app/layout.jsx).
 * Cung cấp: user hiện tại, trạng thái loading, và các hàm đăng nhập/xuất.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lấy session hiện có (nếu người dùng đã đăng nhập trước đó)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Lắng nghe thay đổi trạng thái đăng nhập (login/logout/refresh token)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Đăng nhập bằng mã OTP gửi qua email (không cần mật khẩu) ---
  async function signInWithOtp(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  // Xác thực mã OTP 6 số người dùng nhận được trong email
  async function verifyOtp(email, token) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) throw error;
  }

  // --- Đăng nhập bằng Google ---
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Xoá luôn cache offline + PIN khoá màn hình khi đăng xuất
    localStorage.removeItem("motocare_cache");
    localStorage.removeItem("motocare_pin");
  }

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    signInWithOtp,
    verifyOtp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được gọi bên trong <AuthProvider>");
  return ctx;
}