"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike, Gauge, Coins, Wrench, Fuel, TrendingUp, ChevronRight } from "lucide-react";
import { fetchVehicles, fetchParts, fetchFuelLogs, fetchMonthlyCost } from "@/lib/api";
import { getEstimatedOdo, computePartStatus } from "@/lib/partStatus";
import { buildConsumptionPoints } from "@/lib/fuelStats";

const ACTIVE_VEHICLE_KEY = "motocare_active_vehicle";

const formatKm = (n) => Math.round(n || 0).toLocaleString("vi-VN");
const formatVND = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

/** Gộp toàn bộ chỉ số của 1 xe từ dữ liệu parts/fuelLogs/monthlyCost đã fetch sẵn */
function buildVehicleSummary(vehicle, parts, fuelLogs, monthlyCost) {
  const { estimatedOdo } = getEstimatedOdo(vehicle);

  const statusCounts = parts.reduce(
    (acc, p) => {
      const { status } = computePartStatus(p, estimatedOdo);
      acc[status] += 1;
      return acc;
    },
    { red: 0, yellow: 0, green: 0 }
  );

  // Ước tính km đã theo dõi qua app = ODO hiện tại - mốc ODO nhỏ nhất từng
  // ghi nhận (từ phụ tùng hoặc lần đổ xăng đầu tiên) — vì app không lưu
  // riêng "ODO lúc mới thêm xe", đây là cách xấp xỉ tốt nhất không cần
  // thêm cột DB mới.
  const allRecordedOdo = [
    ...parts.map((p) => p.last_service_odo),
    ...fuelLogs.map((f) => f.odo_at_fill),
  ].filter((n) => typeof n === "number");
  const minRecordedOdo = allRecordedOdo.length ? Math.min(...allRecordedOdo) : vehicle.current_odo;
  const trackedKm = Math.max(0, vehicle.current_odo - minRecordedOdo);

  const lifetimeMaintenanceCost = monthlyCost.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const serviceCount = monthlyCost.reduce((sum, m) => sum + (m.service_count || 0), 0);

  const lifetimeFuelCost = fuelLogs.reduce((sum, f) => sum + (f.total_cost || 0), 0);
  const consumptionPoints = buildConsumptionPoints(fuelLogs);
  const avgConsumption = consumptionPoints.length
    ? consumptionPoints.reduce((s, p) => s + p.consumption, 0) / consumptionPoints.length
    : null;

  return {
    statusCounts,
    trackedKm,
    lifetimeMaintenanceCost,
    lifetimeFuelCost,
    totalCost: lifetimeMaintenanceCost + lifetimeFuelCost,
    serviceCount,
    fuelFillCount: fuelLogs.length,
    avgConsumption,
  };
}

export default function OverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{ vehicle, summary }]

  useEffect(() => {
    async function load() {
      const vehicles = await fetchVehicles();

      const results = await Promise.all(
        vehicles.map(async (v) => {
          const [parts, fuelLogs, monthlyCost] = await Promise.all([
            fetchParts(v.id),
            fetchFuelLogs(v.id),
            fetchMonthlyCost(v.id),
          ]);
          return { vehicle: v, summary: buildVehicleSummary(v, parts, fuelLogs, monthlyCost) };
        })
      );

      setRows(results);
      setLoading(false);
    }
    load();
  }, []);

  function handleSelectVehicle(vehicleId) {
    localStorage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
    router.push("/");
  }

  const grandTotalCost = rows.reduce((sum, r) => sum + r.summary.totalCost, 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)] px-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center" aria-label="Quay lại">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[15px] font-semibold">Tổng quan xe</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-10">Đang tải...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-10">Bạn chưa có xe nào.</p>
        ) : (
          <>
            {rows.length > 1 && (
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5 flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div>
                  <div className="text-lg font-bold font-mono tabular-nums">{formatVND(grandTotalCost)}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Tổng chi phí trọn đời — tất cả xe</div>
                </div>
              </div>
            )}

            {rows.map(({ vehicle, summary }) => (
              <button
                key={vehicle.id}
                onClick={() => handleSelectVehicle(vehicle.id)}
                className="w-full text-left rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Bike className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold truncate">{vehicle.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{vehicle.plate_number}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <MiniStat cfg="red" count={summary.statusCounts.red} label="Cần gấp" />
                  <MiniStat cfg="yellow" count={summary.statusCounts.yellow} label="Sắp tới" />
                  <MiniStat cfg="green" count={summary.statusCounts.green} label="An toàn" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <InfoRow icon={<Gauge className="w-3.5 h-3.5" />} label="ODO hiện tại" value={`${formatKm(vehicle.current_odo)} km`} />
                  <InfoRow icon={<TrendingUp className="w-3.5 h-3.5" />} label="Đã theo dõi qua app" value={`${formatKm(summary.trackedKm)} km`} />
                  <InfoRow icon={<Wrench className="w-3.5 h-3.5" />} label="Số lần bảo dưỡng" value={`${summary.serviceCount} lần`} />
                  <InfoRow
                    icon={<Fuel className="w-3.5 h-3.5" />}
                    label="Tiêu thụ TB"
                    value={summary.avgConsumption !== null ? `${summary.avgConsumption.toFixed(2)} L/100km` : "Chưa đủ dữ liệu"}
                  />
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Tổng chi phí trọn đời</span>
                  <span className="text-sm font-mono tabular-nums font-semibold text-[var(--accent)]">{formatVND(summary.totalCost)}</span>
                </div>
              </button>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

const MINI_CFG = {
  red: "bg-[var(--danger-bg)]/10 text-[var(--danger-text)] border-[var(--danger-bg)]/30",
  yellow: "bg-[var(--warn-bg)]/10 text-[var(--warn-text)] border-[var(--warn-bg)]/30",
  green: "bg-[var(--good-bg)]/10 text-[var(--good-text)] border-[var(--good-bg)]/30",
};

function MiniStat({ cfg, count, label }) {
  return (
    <div className={`rounded-xl border px-2 py-1.5 flex flex-col items-center gap-0.5 ${MINI_CFG[cfg]}`}>
      <span className="text-sm font-bold font-mono tabular-nums leading-none">{count}</span>
      <span className="text-[9px] uppercase tracking-wide">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[var(--text-muted)] mb-0.5">{icon} {label}</div>
      <div className="font-mono tabular-nums font-medium">{value}</div>
    </div>
  );
}