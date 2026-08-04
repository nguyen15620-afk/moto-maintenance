// app/layout.jsx
// Layout gốc — khai báo metadata + các thẻ <meta> tối ưu cho iOS Safari
// (chạy full-screen khi Add to Home Screen, không hiện thanh địa chỉ).

import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata = {
  title: "MotoCare — Quản lý bảo dưỡng xe máy",
  description: "Theo dõi lịch bảo dưỡng và thay thế phụ tùng xe máy",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // nội dung tràn lên vùng status bar
    title: "MotoCare",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // tràn viền, dùng chung với env(safe-area-inset-*) trong CSS
  themeColor: "#0B0F14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="bg-[#0B0F14]">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}