"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, TrendingUp, Wrench } from "lucide-react";
import { fetchVehicles, fetchMonthlyCost, fetchTopCostParts, fetchYearSummary } from "@/lib/api";

const formatVND = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const monthLabel = (dateStr) => {
  const d = new Date(dateStr);
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function CostReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState([]);
  const [topParts, setTopParts] = useState([]);
  const [yearSummary, setYearSummary] = useState({ totalCost: 0, serviceCount: 0 });

  useEffect(() => {
    async function load() {
      const vehicles = await fetchVehicles();
      const savedId = localStorage.getItem("motocare_active_vehicle");
      // Không tin mù quáng giá trị trong localStorage — chỉ dùng nếu ID đó
      // THỰC SỰ nằm trong danh sách xe của tài khoản đang đăng nhập (tránh
      // trường hợp localStorage còn sót ID từ tài khoản/xe khác đã test trước đó).
      const activeVehicle = vehicles.find((v) => v.id === savedId) || vehicles[0];
      const activeId = activeVehicle?.id;
      if (activeId) localStorage.setItem("motocare_active_vehicle", activeId); // tự sửa lại nếu sai
      if (!activeId) return setLoading(false);

      const [m, t, y] = await Promise.all([
        fetchMonthlyCost(activeId),
        fetchTopCostParts(activeId),
        fetchYearSummary(activeId, new Date().getFullYear()),
      ]);
      setMonthly(m);
      setTopParts(t.filter((p) => p.total_cost > 0));
      setYearSummary(y);
      setLoading(false);
    }

    load();

    // Tự tải lại khi người dùng quay lại tab/trang này (VD: vừa thêm chi phí
    // ở Dashboard rồi bấm vào biểu đồ 📊 mà không reload cả trang)
    function handleFocus() {
      load();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") load();
    });
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const maxMonthly = Math.max(...monthly.map((m) => m.total_cost), 1);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)] px-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[15px] font-semibold">Thống kê chi phí</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-4 space-y-5">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-10">Đang tải...</p>
        ) : (
          <>
            {/* Tổng quan năm nay */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
                <Coins className="w-4 h-4 text-[var(--accent)] mb-1.5" />
                <div className="text-lg font-bold font-mono tabular-nums">{formatVND(yearSummary.totalCost)}</div>
                <div className="text-[11px] text-[var(--text-muted)]">Tổng chi năm {new Date().getFullYear()}</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
                <Wrench className="w-4 h-4 text-[var(--accent)] mb-1.5" />
                <div className="text-lg font-bold font-mono tabular-nums">{yearSummary.serviceCount}</div>
                <div className="text-[11px] text-[var(--text-muted)]">Lần bảo dưỡng năm nay</div>
              </div>
            </div>

            {/* Biểu đồ cột đơn giản theo tháng — thuần CSS, không cần thư viện chart */}
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent)]" /> Chi phí theo tháng
              </h2>
              {monthly.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Chưa có dữ liệu chi phí.</p>
              ) : (
                <div className="flex items-end gap-2 h-36 rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
                  {monthly.slice(0, 6).reverse().map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <div
                        className="w-full rounded-t-md bg-[var(--accent)]"
                        style={{ height: `${Math.max((m.total_cost / maxMonthly) * 100, 4)}%` }}
                        title={formatVND(m.total_cost)}
                      />
                      <span className="text-[9px] text-[var(--text-muted)]">
                        {new Date(m.month).getMonth() + 1}/{String(new Date(m.month).getFullYear()).slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Danh sách theo tháng chi tiết */}
            <section className="space-y-2">
              {monthly.map((m) => (
                <div key={m.month} className="flex items-center justify-between rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2.5">
                  <span className="text-sm">{monthLabel(m.month)}</span>
                  <div className="text-right">
                    <div className="text-sm font-mono tabular-nums">{formatVND(m.total_cost)}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{m.service_count} lần</div>
                  </div>
                </div>
              ))}
            </section>

            {/* Top phụ tùng tốn chi phí nhất */}
            <section>
              <h2 className="text-sm font-semibold mb-3">Top phụ tùng tốn chi phí nhất</h2>
              <div className="space-y-2">
                {topParts.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">Chưa có dữ liệu.</p>
                )}
                {topParts.map((p, i) => (
                  <div key={p.part_id} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2.5">
                    <span className="w-5 text-xs text-[var(--text-muted)] font-mono">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{p.times_serviced} lần thay</div>
                    </div>
                    <span className="text-sm font-mono tabular-nums text-[var(--accent)]">{formatVND(p.total_cost)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}