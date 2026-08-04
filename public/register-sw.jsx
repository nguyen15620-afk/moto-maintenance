"use client";

import { useEffect } from "react";

// Đăng ký Service Worker sau khi trang đã load xong,
// tách thành client component riêng để không ảnh hưởng SSR của layout.
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.error("SW register failed:", err));
      });
    }
  }, []);

  return null;
}