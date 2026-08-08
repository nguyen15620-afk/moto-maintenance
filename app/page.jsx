"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bike, Gauge, Pencil, X, CheckCircle2, AlertTriangle, AlertCircle,
  Wrench, Calendar, Coins, StickyNote, Loader2, BarChart3, LogOut, WifiOff, Gauge as SpeedIcon, History,Trash2, Pencil, History
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchVehicles, updateVehicleOdo, updateAvgKmPerDay, updateVehicleInfo, addVehicle,
  fetchParts, addMaintenanceLog,
  addPart, updatePart, deactivatePart, // ← thêm
} from "@/lib/api";
import { saveCache, loadCache } from "@/lib/offlineCache";
import { vibrate } from "@/lib/haptics";
import VehicleSwitcher from "@/components/VehicleSwitcher";
import VehicleFormModal from "@/components/VehicleFormModal";
import PartHistoryModal from "@/components/PartHistoryModal";
import PinLock from "@/components/PinLock";
import PartFormModal from "@/components/PartFormModal";

const DAY_MS = 1000 * 60 * 60 * 24;
const ACTIVE_VEHICLE_KEY = "motocare_active_vehicle";

/**
 * Tính ODO ƯỚC TÍNH tại thời điểm hiện tại — KHÔNG ghi vào DB, chỉ dùng để
 * hiển thị và tính trạng thái phụ tùng "tự nhích" theo từng ngày.
 * ODO thật (vehicle.current_odo) vẫn giữ nguyên cho tới khi người dùng tự
 * bấm "Cập nhật" — tránh bị lệch số nếu có ngày không đi xe.
 */
function getEstimatedOdo(vehicle) {
  if (!vehicle) return { estimatedOdo: 0, daysSinceUpdate: 0 };
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(vehicle.odo_updated_at).getTime()) / DAY_MS
  );
  const safeDays = Math.max(daysSinceUpdate, 0); // phòng trường hợp lệch giờ/timezone ra số âm
  const avg = vehicle.avg_km_per_day || 0;
  return {
    estimatedOdo: vehicle.current_odo + avg * safeDays,
    daysSinceUpdate: safeDays,
  };
}

function computePartStatus(part, currentOdo) {
  const today = new Date();
  const kmSince = currentOdo - part.last_service_odo;
  const daysSince = Math.floor((today.getTime() - new Date(part.last_service_date).getTime()) / DAY_MS);
  const kmRatio = part.interval_km ? kmSince / part.interval_km : null;
  const monthsRatio = part.interval_months ? daysSince / (part.interval_months * 30) : null;
  const ratios = [kmRatio, monthsRatio].filter((r) => r !== null);
  const usedRatio = Math.max(...ratios);

  const remainingKm = part.interval_km ? part.interval_km - kmSince : null;
  const remainingDaysByTime = part.interval_months ? part.interval_months * 30 - daysSince : null;

  let status = "green";
  if (usedRatio >= 1) status = "red";
  else if (usedRatio >= 0.8) status = "yellow";

  return { usedRatio: Math.min(usedRatio, 1.3), status, remainingKm, remainingDaysByTime };
}

const STATUS_CONFIG = {
  red: { label: "Quá hạn", text: "text-[var(--danger-text)]", bg: "bg-[var(--danger-bg)]", chip: "bg-[var(--danger-bg)]/10 text-[var(--danger-text)] border-[var(--danger-bg)]/30" },
  yellow: { label: "Sắp đến hạn", text: "text-[var(--warn-text)]", bg: "bg-[var(--warn-bg)]", chip: "bg-[var(--warn-bg)]/10 text-[var(--warn-text)] border-[var(--warn-bg)]/30" },
  green: { label: "An toàn", text: "text-[var(--good-text)]", bg: "bg-[var(--good-bg)]", chip: "bg-[var(--good-bg)]/10 text-[var(--good-text)] border-[var(--good-bg)]/30" },
};

const formatDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatKm = (n) => n.toLocaleString("vi-VN");

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [activeVehicle, setActiveVehicle] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const [odoModalOpen, setOdoModalOpen] = useState(false);
  const [avgKmModalOpen, setAvgKmModalOpen] = useState(false);
  const [serviceModalPart, setServiceModalPart] = useState(null);
  const [vehicleFormMode, setVehicleFormMode] = useState(null); // null | "add" | "edit"
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [historyModalPart, setHistoryModalPart] = useState(null); // part đang xem lịch sử
  const [filter, setFilter] = useState("all");

  const [partFormMode, setPartFormMode] = useState(null); // null | "add" | "edit"
  const [editingPart, setEditingPart] = useState(null);

  // --- Auth gate: chưa đăng nhập -> chuyển sang /login ---
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // --- Load dữ liệu, có fallback offline cache ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const vs = await fetchVehicles();
      const savedId = localStorage.getItem(ACTIVE_VEHICLE_KEY);
      const current = vs.find((v) => v.id === savedId) || vs[0];
      const p = await fetchParts(current.id);

      // Luôn đồng bộ lại localStorage với xe đang thực sự active — kể cả khi
      // rơi vào trường hợp fallback vs[0] (chưa từng bấm "Đổi xe") hoặc xe đã
      // lưu trước đó không còn tồn tại (bị xoá) — tránh /stats đọc nhầm ID cũ.
      localStorage.setItem(ACTIVE_VEHICLE_KEY, current.id);

      setVehicles(vs);
      setActiveVehicle(current);
      setParts(p);
      setOffline(false);
      saveCache({ vehicle: current, parts: p }); // cache lại cho lần mất mạng sau
    } catch (err) {
      console.error(err);
      // Mất mạng / lỗi Supabase -> dùng dữ liệu cache gần nhất
      const cached = loadCache();
      if (cached) {
        setActiveVehicle(cached.vehicle);
        setParts(cached.parts);
        setVehicles([cached.vehicle]);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // --- Chuyển xe ---
  async function handleSwitchVehicle(vehicleId) {
    vibrate(10);
    const v = vehicles.find((x) => x.id === vehicleId);
    setActiveVehicle(v);
    localStorage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
    const p = await fetchParts(vehicleId);
    setParts(p);
    saveCache({ vehicle: v, parts: p });
  }

  // ODO ước tính hôm nay — dùng để tính trạng thái/% hao mòn, "tự nhích" mỗi ngày
  // mà không cần sửa current_odo thật trong DB (xem getEstimatedOdo() ở trên).
  const { estimatedOdo, daysSinceUpdate } = useMemo(
    () => getEstimatedOdo(activeVehicle),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVehicle?.current_odo, activeVehicle?.odo_updated_at, activeVehicle?.avg_km_per_day]
  );

  const partsWithStatus = useMemo(() => {
    if (!activeVehicle) return [];
    return parts
      .map((part) => ({ ...part, ...computePartStatus(part, estimatedOdo) }))
      .sort((a, b) => b.usedRatio - a.usedRatio);
  }, [parts, activeVehicle, estimatedOdo]);

  const summary = useMemo(
    () =>
      partsWithStatus.reduce(
        (acc, p) => {
          acc[p.status] += 1;
          return acc;
        },
        { red: 0, yellow: 0, green: 0 }
      ),
    [partsWithStatus]
  );

  const filteredParts = filter === "all" ? partsWithStatus : partsWithStatus.filter((p) => p.status === filter);

  // Gọi lại fetchParts cho xe đang chọn — dùng sau khi thêm/sửa/xoá log,
  // vì trigger DB có thể đã tính lại last_service_odo/last_service_date.
  const refreshParts = useCallback(async () => {
    if (!activeVehicle) return;
    const p = await fetchParts(activeVehicle.id);
    setParts(p);
    saveCache({ vehicle: activeVehicle, parts: p });
  }, [activeVehicle]);

  async function handleUpdateOdo(newOdo) {
    const updated = await updateVehicleOdo(activeVehicle.id, newOdo);
    setActiveVehicle(updated);
    saveCache({ vehicle: updated, parts });
    setOdoModalOpen(false);
    vibrate([10, 20]);
  }

  async function handleUpdateAvgKm(avg) {
    const updated = await updateAvgKmPerDay(activeVehicle.id, avg);
    setActiveVehicle(updated);
    saveCache({ vehicle: updated, parts });
    setAvgKmModalOpen(false);
    vibrate(10);
  }

  // --- Thêm xe mới ---
  async function handleAddVehicle(values) {
    const newVehicle = await addVehicle(values);
    const updatedVehicles = [...vehicles, newVehicle];
    setVehicles(updatedVehicles);
    setActiveVehicle(newVehicle);
    localStorage.setItem(ACTIVE_VEHICLE_KEY, newVehicle.id);
    setParts([]); // xe mới chưa có phụ tùng nào — có thể thêm tay trong Supabase Table Editor
    saveCache({ vehicle: newVehicle, parts: [] });
    setVehicleFormMode(null);
  }

  // --- Sửa thông tin xe (tên/hãng/dòng xe/biển số) ---
  async function handleEditVehicle(values) {
    const updated = await updateVehicleInfo(editingVehicle.id, values);
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    if (activeVehicle?.id === updated.id) {
      setActiveVehicle(updated);
      saveCache({ vehicle: updated, parts });
    }
    setVehicleFormMode(null);
    setEditingVehicle(null);
  }

  async function handleSaveService({ partId, date, odo, cost, note }) {
    await addMaintenanceLog({ partId, vehicleId: activeVehicle.id, date, odo, cost, note });
    const refreshed = await fetchParts(activeVehicle.id);
    setParts(refreshed);
    saveCache({ vehicle: activeVehicle, parts: refreshed });
    setServiceModalPart(null);
    vibrate([10, 30, 10]);
  }

  async function handleSavePart(values) {
  if (editingPart) {
    await updatePart(editingPart.id, values);
  } else {
    await addPart({ vehicleId: activeVehicle.id, ...values });
  }
  await refreshParts();
  setPartFormMode(null);
  setEditingPart(null);
  vibrate([10, 30, 10]);
}

async function handleDeletePart(partId) {
  await deactivatePart(partId);
  await refreshParts();
  vibrate(200);
}

  if (authLoading || (loading && !activeVehicle)) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }
  if (!user) return null; // đang chuyển hướng sang /login
  if (!activeVehicle) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-sm text-[var(--text-muted)] text-center">Bạn chưa có xe nào cả.</p>
        <button
          onClick={() => setVehicleFormMode("add")}
          className="bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold rounded-2xl px-5 py-3 text-sm"
        >
          + Thêm xe đầu tiên
        </button>
        {vehicleFormMode === "add" && (
          <VehicleFormModal
            mode="add"
            onClose={() => setVehicleFormMode(null)}
            onSave={handleAddVehicle}
          />
        )}
      </div>
    );
  }

  return (
    <PinLock>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
        {offline && (
          <div className="bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs flex items-center justify-center gap-1.5 py-1.5 px-4">
            <WifiOff className="w-3.5 h-3.5" /> Đang xem dữ liệu ngoại tuyến (cache gần nhất)
          </div>
        )}

        <header className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)] px-4 pt-[env(safe-area-inset-top)]">
          <div className="max-w-md mx-auto py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[15px] font-semibold truncate">{activeVehicle.name}</h1>
                  <p className="text-xs text-[var(--text-muted)] truncate">{activeVehicle.plate_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <VehicleSwitcher
                  vehicles={vehicles}
                  activeVehicle={activeVehicle}
                  onSwitch={handleSwitchVehicle}
                  onAddVehicle={() => setVehicleFormMode("add")}
                  onEditVehicle={(v) => {
                    setEditingVehicle(v);
                    setVehicleFormMode("edit");
                  }}
                />
                <button
                  onClick={() => router.push("/stats")}
                  className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center"
                >
                  <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
                <button
                  onClick={() => { vibrate(10); signOut(); }}
                  className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            <button
              onClick={() => { vibrate(10); setOdoModalOpen(true); }}
              className="mt-3 w-full flex items-center justify-between rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2.5">
                <Gauge className="w-4 h-4 text-[var(--accent)]" />
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    ODO ước tính hôm nay
                  </div>
                  <div className="font-mono tabular-nums text-2xl font-bold text-[var(--accent)] tracking-wider">
                    {formatKm(Math.round(estimatedOdo))}
                    <span className="text-xs text-[var(--text-muted)] ml-1">km</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Đã ghi nhận thật: {formatKm(activeVehicle.current_odo)} km
                    {daysSinceUpdate > 0 && ` · ${daysSinceUpdate} ngày trước`}
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 rounded-full shrink-0">
                <Pencil className="w-3 h-3" /> Cập nhật
              </span>
            </button>

            {/* Tốc độ trung bình — phục vụ Smart Forecasting */}
            <button
              onClick={() => { vibrate(10); setAvgKmModalOpen(true); }}
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
            >
              <SpeedIcon className="w-3.5 h-3.5" />
              Trung bình {activeVehicle.avg_km_per_day || 20} km/ngày
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4">
          <section className="grid grid-cols-3 gap-2 mt-4">
            <SummaryChip active={filter === "red"} onClick={() => setFilter(filter === "red" ? "all" : "red")} icon={<AlertCircle className="w-4 h-4" />} count={summary.red} label="Cần gấp" cfg={STATUS_CONFIG.red} />
            <SummaryChip active={filter === "yellow"} onClick={() => setFilter(filter === "yellow" ? "all" : "yellow")} icon={<AlertTriangle className="w-4 h-4" />} count={summary.yellow} label="Sắp tới" cfg={STATUS_CONFIG.yellow} />
            <SummaryChip active={filter === "green"} onClick={() => setFilter(filter === "green" ? "all" : "green")} icon={<CheckCircle2 className="w-4 h-4" />} count={summary.green} label="An toàn" cfg={STATUS_CONFIG.green} />
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-muted)]">Danh sách phụ tùng</h2>
              <div className="flex items-center gap-3">
                {filter !== "all" && (
                  <button onClick={() => setFilter("all")} className="text-xs text-[var(--accent)]">Xem tất cả</button>
                )}
                <button
                  onClick={() => { vibrate(10); setEditingPart(null); setPartFormMode("add"); }}
                  className="text-xs text-[var(--accent)] font-medium flex items-center gap-1"
                >
                  + Thêm phụ tùng
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredParts.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-10">Không có phụ tùng nào ở trạng thái này 🎉</p>
              )}
              {filteredParts.map((part) => (
                <PartCard
                  key={part.id}
                  part={part}
                  avgKmPerDay={activeVehicle.avg_km_per_day || 20}
                  onMarkDone={() => { vibrate(10); setServiceModalPart(part); }}
                  onViewHistory={() => { vibrate(10); setHistoryModalPart(part); }}
                  onEdit={() => { vibrate(10); setEditingPart(part); setPartFormMode("edit"); }}
                  onDelete={() => handleDeletePart(part.id)}
                />
              ))}
            </div>
          </section>
        </main>

        {odoModalOpen && (
          <OdoModal currentOdo={activeVehicle.current_odo} suggestedOdo={Math.round(estimatedOdo)} onClose={() => setOdoModalOpen(false)} onSave={handleUpdateOdo} />
        )}
        {avgKmModalOpen && (
          <AvgKmModal current={activeVehicle.avg_km_per_day || 20} onClose={() => setAvgKmModalOpen(false)} onSave={handleUpdateAvgKm} />
        )}
        {serviceModalPart && (
          <ServiceModal part={serviceModalPart} currentOdo={Math.round(estimatedOdo)} onClose={() => setServiceModalPart(null)} onSave={handleSaveService} />
        )}
        {historyModalPart && (
          <PartHistoryModal
            part={historyModalPart}
            onClose={() => setHistoryModalPart(null)}
            onChanged={refreshParts}
          />
        )}

        {vehicleFormMode === "add" && (
          <VehicleFormModal
            mode="add"
            onClose={() => setVehicleFormMode(null)}
            onSave={handleAddVehicle}
          />
        )}
        {vehicleFormMode === "edit" && editingVehicle && (
          <VehicleFormModal
            mode="edit"
            initialValues={{
              name: editingVehicle.name,
              brand: editingVehicle.brand,
              model: editingVehicle.model,
              plateNumber: editingVehicle.plate_number,
            }}
            onClose={() => { setVehicleFormMode(null); setEditingVehicle(null); }}
            onSave={handleEditVehicle}
          />
        )}

        {partFormMode && (
          <PartFormModal
            mode={partFormMode}
            initialValues={
              editingPart
                ? { name: editingPart.name, intervalKm: editingPart.interval_km, intervalMonths: editingPart.interval_months }
                : { currentOdo: Math.round(estimatedOdo) }
            }
            onClose={() => { setPartFormMode(null); setEditingPart(null); }}
            onSave={handleSavePart}
          />
        )}
      </div>
    </PinLock>
  );
}

// ------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------

function SummaryChip({ icon, count, label, cfg, active, onClick }) {
  return (
    <button onClick={() => { vibrate(10); onClick(); }} className={`rounded-2xl border px-2 py-3 flex flex-col items-center gap-1 transition-all ${cfg.chip} ${active ? "ring-2 ring-[var(--accent)]/40" : "opacity-90"}`}>
      {icon}
      <span className="text-lg font-bold font-mono tabular-nums leading-none">{count}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </button>
  );
}

function PartCard({ part, avgKmPerDay, onMarkDone, onViewHistory, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = STATUS_CONFIG[part.status];
  const pct = Math.min(Math.round(part.usedRatio * 100), 100);

  const forecastDaysByKm = part.remainingKm !== null ? Math.round(part.remainingKm / avgKmPerDay) : null;
  const candidates = [forecastDaysByKm, part.remainingDaysByTime].filter((d) => d !== null);
  const forecastDays = candidates.length ? Math.min(...candidates) : null;

  const remainingText =
    part.remainingKm !== null
      ? part.remainingKm >= 0 ? `Còn ${formatKm(part.remainingKm)} km` : `Quá hạn ${formatKm(Math.abs(part.remainingKm))} km`
      : part.remainingDaysByTime >= 0 ? `Còn ~${part.remainingDaysByTime} ngày` : `Quá hạn ~${Math.abs(part.remainingDaysByTime)} ngày`;

  const forecastText =
    forecastDays === null ? null : forecastDays >= 0 ? `Dự kiến còn ~${forecastDays} ngày` : `Đã trễ ~${Math.abs(forecastDays)} ngày`;

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />
            <h3 className="text-[15px] font-medium truncate">{part.name}</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Lần cuối: {formatKm(part.last_service_odo)} km · {formatDateVN(part.last_service_date)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onViewHistory} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" title="Xem lịch sử">
            <History className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
          <button onClick={onEdit} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" title="Sửa phụ tùng">
            <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
          {confirmDelete ? (
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="h-8 px-2 rounded-full bg-[var(--danger-bg)] text-white text-[10px] font-medium whitespace-nowrap"
            >
              Xoá?
            </button>
          ) : (
            <button
              onClick={() => { vibrate(10); setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"
              title="Xoá phụ tùng"
            >
              <Trash2 className="w-3.5 h-3.5 text-[var(--danger-text)]" />
            </button>
          )}
          <button onClick={onMarkDone} className="flex items-center gap-1 text-xs font-medium bg-[var(--accent)] text-[var(--accent-contrast)] active:scale-95 transition-all px-2.5 py-1.5 rounded-full whitespace-nowrap">
            <Wrench className="w-3 h-3" /> Đã làm
          </button>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full ${cfg.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label} · {pct}%</span>
          <span className="text-xs text-[var(--text-muted)]">{remainingText}</span>
        </div>
        {forecastText && (
          <div className="text-[11px] text-[var(--text-muted)] mt-1">📅 {forecastText} (theo {avgKmPerDay} km/ngày)</div>
        )}
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface)] border-t border-[var(--border)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-[slideUp_0.25s_ease-out]">
        <div className="w-9 h-1 bg-black/10 dark:bg-white/15 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

function OdoModal({ currentOdo, suggestedOdo, onClose, onSave }) {
  const [value, setValue] = useState(String(suggestedOdo ?? currentOdo));
  const [saving, setSaving] = useState(false);
  const isValid = Number(value) >= currentOdo && value !== "";

  async function handleSave() {
    setSaving(true);
    try { await onSave(Number(value)); } finally { setSaving(false); }
  }

  return (
    <ModalShell title="Cập nhật ODO" onClose={onClose}>
      <label className="text-xs text-[var(--text-muted)] mb-1.5 block">
        Số km hiện tại trên đồng hồ (gợi ý theo ước tính, sửa lại nếu khác)
      </label>
      <input type="number" inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
        className="w-full font-mono tabular-nums text-3xl font-bold bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl px-4 py-3 text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
      {!isValid && value !== "" && <p className="text-xs text-[var(--danger-text)] mt-2">ODO mới phải ≥ ODO hiện tại ({formatKm(currentOdo)} km)</p>}
      <button disabled={!isValid || saving} onClick={handleSave}
        className="w-full mt-5 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu ODO mới
      </button>
    </ModalShell>
  );
}

function AvgKmModal({ current, onClose, onSave }) {
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const isValid = Number(value) > 0;

  async function handleSave() {
    setSaving(true);
    try { await onSave(Number(value)); } finally { setSaving(false); }
  }

  return (
    <ModalShell title="Tốc độ đi trung bình" onClose={onClose}>
      <label className="text-xs text-[var(--text-muted)] mb-1.5 block">
        Trung bình bạn đi bao nhiêu km mỗi ngày? Dùng để ước tính "còn bao nhiêu ngày" đến hạn bảo dưỡng.
      </label>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          className="w-full font-mono tabular-nums text-2xl font-bold bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl px-4 py-3 text-[var(--accent)] focus:outline-none" />
        <span className="text-sm text-[var(--text-muted)] shrink-0">km/ngày</span>
      </div>
      <button disabled={!isValid || saving} onClick={handleSave}
        className="w-full mt-5 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
      </button>
    </ModalShell>
  );
}

function ServiceModal({ part, currentOdo, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odo, setOdo] = useState(String(currentOdo));
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const isValid = odo !== "" && Number(odo) >= part.last_service_odo;

  async function handleSubmit() {
    setSaving(true);
    try { await onSave({ partId: part.id, date, odo: Number(odo), cost: cost ? Number(cost) : 0, note }); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={`Đã bảo dưỡng: ${part.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field icon={<Calendar className="w-4 h-4" />} label="Ngày thực hiện">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
        </Field>
        <Field icon={<Gauge className="w-4 h-4" />} label="ODO lúc làm (km)">
          <input type="number" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none font-mono tabular-nums" />
        </Field>
        <Field icon={<Coins className="w-4 h-4" />} label="Chi phí (VNĐ, không bắt buộc)">
          <input type="number" inputMode="numeric" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
        </Field>
        <Field icon={<StickyNote className="w-4 h-4" />} label="Ghi chú / thương hiệu">
          <input type="text" placeholder="VD: Nhớt Repsol 10W40..." value={note} onChange={(e) => setNote(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
        </Field>
      </div>
      {!isValid && <p className="text-xs text-[var(--danger-text)] mt-2">ODO lúc làm phải ≥ lần bảo dưỡng trước ({formatKm(part.last_service_odo)} km)</p>}
      <button disabled={!isValid || saving} onClick={handleSubmit}
        className="w-full mt-5 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Xác nhận đã bảo dưỡng
      </button>
    </ModalShell>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">{icon} {label}</div>
      {children}
    </div>
  );
}