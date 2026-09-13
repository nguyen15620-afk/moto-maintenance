"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, TrendingUp, Wrench, Fuel, Download } from "lucide-react";
import { fetchVehicles, fetchMonthlyCost, fetchTopCostParts, fetchYearSummary, fetchFuelLogs } from "@/lib/api";

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
  const [yearSummary, setYearSummary] = useState({ totalCost: 0, serviceCount: 0, fuelCost: 0 });

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

      const [m, t, y, fuelLogs] = await Promise.all([
        fetchMonthlyCost(activeId),
        fetchTopCostParts(activeId),
        fetchYearSummary(activeId, new Date().getFullYear()),
        fetchFuelLogs(activeId),
      ]);
      // Tính chi phí xăng trong năm hiện tại
      const currentYear = new Date().getFullYear();
      const fuelCostThisYear = fuelLogs
        .filter((f) => f.fill_date && new Date(f.fill_date).getFullYear() === currentYear)
        .reduce((sum, f) => sum + (f.total_cost || 0), 0);
      setMonthly(m);
      setTopParts(t.filter((p) => p.total_cost > 0));
      setYearSummary({ ...y, fuelCost: fuelCostThisYear });
      setLoading(false);
    }

    load();

    // Tự tải lại khi người dùng quay lại tab/trang này (VD: vừa thêm chi phí
    // ở Dashboard rồi bấm vào biểu đồ 📊 mà không reload cả trang)
    function handleFocus() {
      load();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") load();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const maxMonthly = Math.max(...monthly.map((m) => m.total_cost), 1);

  function handleExportCSV() {
    if (!monthly.length) return;
    const header = "Tháng,Chi phí bảo dưỡng (VNĐ),Số lần";
    const rows = monthly.map((m) => {
      const d = new Date(m.month);
      return `Tháng ${d.getMonth() + 1}/${d.getFullYear()},${m.total_cost},${m.service_count}`;
    });
    const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `motocare_chiphi_${new Date().getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)] px-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center" aria-label="Quay lại">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[15px] font-semibold flex-1">Thống kê chi phí</h1>
          {!loading && monthly.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center"
              title="Xuất CSV"
              aria-label="Xuất dữ liệu ra file CSV"
            >
              <Download className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
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
                <div className="text-lg font-bold font-mono tabular-nums">{formatVND(yearSummary.totalCost + yearSummary.fuelCost)}</div>
                <div className="text-[11px] text-[var(--text-muted)]">Tổng chi năm {new Date().getFullYear()}</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
                <Wrench className="w-4 h-4 text-[var(--accent)] mb-1.5" />
                <div className="text-lg font-bold font-mono tabular-nums">{yearSummary.serviceCount}</div>
                <div className="text-[11px] text-[var(--text-muted)]">Lần bảo dưỡng năm nay</div>
              </div>
            </div>

            {/* Phân tách chi phí bảo dưỡng vs xăng */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-0.5"><Wrench className="w-3 h-3" /> Bảo dưỡng</div>
                <div className="text-sm font-mono tabular-nums font-medium">{formatVND(yearSummary.totalCost)}</div>
              </div>
              <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-0.5"><Fuel className="w-3 h-3" /> Xăng</div>
                <div className="text-sm font-mono tabular-nums font-medium">{formatVND(yearSummary.fuelCost)}</div>
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
                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
                  <div className="relative" style={{ height: 120 }}>
                    <div className="absolute inset-0 flex items-end gap-2">
                      {monthly.slice(0, 6).reverse().map((m) => (
                        <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                          <span className="text-[8px] font-mono text-[var(--text-muted)] mb-1 truncate w-full text-center">
                            {(m.total_cost / 1000).toFixed(0)}k
                          </span>
                          <div
                            className="w-full rounded-t-md bg-[var(--accent)]"
                            style={{ height: `${Math.max((m.total_cost / maxMonthly) * 100, 4)}%` }}
                            title={formatVND(m.total_cost)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    {monthly.slice(0, 6).reverse().map((m) => (
                      <span key={m.month} className="flex-1 text-[9px] text-[var(--text-muted)] text-center">
                        {new Date(m.month).getMonth() + 1}/{String(new Date(m.month).getFullYear()).slice(2)}
                      </span>
                    ))}
                  </div>
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