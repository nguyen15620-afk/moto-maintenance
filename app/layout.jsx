// app/layout.jsx
import "./globals.css";
import RegisterSW from "./register-sw";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "MotoCare — Quản lý bảo dưỡng xe máy",
  description: "Theo dõi lịch bảo dưỡng và thay thế phụ tùng xe máy",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MotoCare",
  },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <RegisterSW />
      </body>
    </html>
  );
}