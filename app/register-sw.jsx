"use client";

import { useEffect } from "react";

// Đăng ký Service Worker sau khi trang đã load xong,
// tách thành client component riêng để không ảnh hưởng SSR của layout.
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function register() {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW register failed:", err));
    }

    // Effect chạy sau khi React hydrate — lúc đó sự kiện "load" thường đã
    // bắn xong, chờ nó sẽ không bao giờ đăng ký được -> đăng ký ngay luôn.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}