"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bike, Gauge, Pencil, X, CheckCircle2, AlertTriangle, AlertCircle,
  Wrench, Calendar, Coins, StickyNote, Loader2,
} from "lucide-react";
import {
  fetchVehicle, updateVehicleOdo, fetchParts, addMaintenanceLog,
} from "@/lib/api";

/**
 * ============================================================
 *  Bản đã nối Supabase — thay cho phần MOCK DATA ở Bước 2.
 *  Toàn bộ UI/logic tính trạng thái (computePartStatus, PartCard,
 *  các Modal...) giữ nguyên như Bước 2 — chỉ khác PHẦN NGUỒN DỮ LIỆU:
 *  useState(initialData) ➜ useEffect fetch từ Supabase.
 * ============================================================
 */

const DAY_MS = 1000 * 60 * 60 * 24;

function computePartStatus(part, currentOdo) {
  const today = new Date();
  const kmSince = currentOdo - part.last_service_odo;
  const daysSince = Math.floor(
    (today.getTime() - new Date(part.last_service_date).getTime()) / DAY_MS
  );
  const kmRatio = part.interval_km ? kmSince / part.interval_km : null;
  const monthsRatio = part.interval_months ? daysSince / (part.interval_months * 30) : null;
  const ratios = [kmRatio, monthsRatio].filter((r) => r !== null);
  const usedRatio = Math.max(...ratios);

  const remainingKm = part.interval_km ? part.interval_km - kmSince : null;
  const remainingDays = part.interval_months ? part.interval_months * 30 - daysSince : null;

  let status = "green";
  if (usedRatio >= 1) status = "red";
  else if (usedRatio >= 0.8) status = "yellow";

  return { usedRatio: Math.min(usedRatio, 1.3), status, remainingKm, remainingDays };
}

const STATUS_CONFIG = {
  red: { label: "Quá hạn", text: "text-rose-400", bg: "bg-rose-500", chip: "bg-rose-500/10 text-rose-400 border-rose-500/30", ring: "ring-rose-500/40" },
  yellow: { label: "Sắp đến hạn", text: "text-amber-400", bg: "bg-amber-400", chip: "bg-amber-400/10 text-amber-300 border-amber-400/30", ring: "ring-amber-400/40" },
  green: { label: "An toàn", text: "text-emerald-400", bg: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30", ring: "ring-emerald-400/30" },
};

const formatDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatKm = (n) => n.toLocaleString("vi-VN");

export default function MotoMaintenanceApp() {
  // --- State dữ liệu thật (thay cho initialVehicle/initialParts) ---
  const [vehicle, setVehicle] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [odoModalOpen, setOdoModalOpen] = useState(false);
  const [serviceModalPart, setServiceModalPart] = useState(null);
  const [filter, setFilter] = useState("all");

  // --- Load dữ liệu ban đầu từ Supabase ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const v = await fetchVehicle();
      const p = await fetchParts(v.id);
      setVehicle(v);
      setParts(p);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu. Kiểm tra kết nối Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const partsWithStatus = useMemo(() => {
    if (!vehicle) return [];
    return parts
      .map((part) => ({ ...part, ...computePartStatus(part, vehicle.current_odo) }))
      .sort((a, b) => b.usedRatio - a.usedRatio);
  }, [parts, vehicle]);

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

  // --- Handlers: gọi Supabase, sau đó cập nhật lại state cục bộ ---

  async function handleUpdateOdo(newOdo) {
    const updated = await updateVehicleOdo(vehicle.id, newOdo);
    setVehicle(updated); // cập nhật ngay UI, không cần fetch lại toàn bộ
    setOdoModalOpen(false);
  }

  async function handleSaveService({ partId, date, odo, cost, note }) {
    await addMaintenanceLog({ partId, vehicleId: vehicle.id, date, odo, cost, note });
    // Trigger DB đã tự cập nhật parts.last_service_odo/date —
    // ở đây ta chỉ cần fetch lại danh sách parts để đồng bộ UI.
    const refreshedParts = await fetchParts(vehicle.id);
    setParts(refreshedParts);
    setServiceModalPart(null);
  }

  // --- Trạng thái loading / lỗi ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center px-6">
        <p className="text-rose-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-zinc-100 pb-10">
      <header className="sticky top-0 z-20 bg-[#0B0F14]/95 backdrop-blur border-b border-white/5 px-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-zinc-100 truncate">{vehicle.name}</h1>
              <p className="text-xs text-zinc-500 truncate">{vehicle.plate_number}</p>
            </div>
          </div>

          <button
            onClick={() => setOdoModalOpen(true)}
            className="mt-3 w-full flex items-center justify-between rounded-2xl bg-[#11161D] border border-white/5 px-4 py-3 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Số km hiện tại</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-cyan-300 tracking-wider">
                  {formatKm(vehicle.current_odo)}
                  <span className="text-xs text-zinc-500 ml-1">km</span>
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 rounded-full">
              <Pencil className="w-3 h-3" /> Cập nhật
            </span>
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
            <h2 className="text-sm font-semibold text-zinc-300">Danh sách phụ tùng</h2>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-xs text-cyan-400">Xem tất cả</button>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredParts.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-10">Không có phụ tùng nào ở trạng thái này 🎉</p>
            )}
            {filteredParts.map((part) => (
              <PartCard key={part.id} part={part} onMarkDone={() => setServiceModalPart(part)} />
            ))}
          </div>
        </section>
      </main>

      {odoModalOpen && (
        <OdoModal currentOdo={vehicle.current_odo} onClose={() => setOdoModalOpen(false)} onSave={handleUpdateOdo} />
      )}
      {serviceModalPart && (
        <ServiceModal part={serviceModalPart} currentOdo={vehicle.current_odo} onClose={() => setServiceModalPart(null)} onSave={handleSaveService} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Sub-components — giống hệt Bước 2, chỉ đổi tên field snake_case
// (last_service_odo, last_service_date) cho khớp với cột Supabase
// ------------------------------------------------------------

function SummaryChip({ icon, count, label, cfg, active, onClick }) {
  return (
    <button onClick={onClick} className={`rounded-2xl border px-2 py-3 flex flex-col items-center gap-1 transition-all ${cfg.chip} ${active ? `ring-2 ${cfg.ring}` : "opacity-90"}`}>
      {icon}
      <span className="text-lg font-bold font-mono tabular-nums leading-none">{count}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </button>
  );
}

function PartCard({ part, onMarkDone }) {
  const cfg = STATUS_CONFIG[part.status];
  const pct = Math.min(Math.round(part.usedRatio * 100), 100);
  const remainingText =
    part.remainingKm !== null
      ? part.remainingKm >= 0 ? `Còn ${formatKm(part.remainingKm)} km` : `Quá hạn ${formatKm(Math.abs(part.remainingKm))} km`
      : part.remainingDays >= 0 ? `Còn ~${part.remainingDays} ngày` : `Quá hạn ~${Math.abs(part.remainingDays)} ngày`;

  return (
    <div className="rounded-2xl bg-[#11161D] border border-white/5 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />
            <h3 className="text-[15px] font-medium text-zinc-100 truncate">{part.name}</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Lần cuối: {formatKm(part.last_service_odo)} km · {formatDateVN(part.last_service_date)}
          </p>
        </div>
        <button onClick={onMarkDone} className="shrink-0 flex items-center gap-1 text-xs font-medium text-zinc-900 bg-cyan-400 hover:bg-cyan-300 active:scale-95 transition-all px-2.5 py-1.5 rounded-full whitespace-nowrap">
          <Wrench className="w-3 h-3" /> Đã làm
        </button>
      </div>
      <div className="mt-3">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full ${cfg.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label} · {pct}%</span>
          <span className="text-xs text-zinc-500">{remainingText}</span>
        </div>
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#11161D] border-t border-white/10 rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-[slideUp_0.25s_ease-out]">
        <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

function OdoModal({ currentOdo, onClose, onSave }) {
  const [value, setValue] = useState(String(currentOdo));
  const [saving, setSaving] = useState(false);
  const isValid = Number(value) >= currentOdo && value !== "";

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(Number(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Cập nhật ODO" onClose={onClose}>
      <label className="text-xs text-zinc-500 mb-1.5 block">Số km hiện tại trên đồng hồ</label>
      <input type="number" inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
        className="w-full font-mono tabular-nums text-3xl font-bold bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50" />
      {!isValid && value !== "" && (
        <p className="text-xs text-rose-400 mt-2">ODO mới phải ≥ ODO hiện tại ({formatKm(currentOdo)} km)</p>
      )}
      <button disabled={!isValid || saving} onClick={handleSave}
        className="w-full mt-5 bg-cyan-400 disabled:bg-white/10 disabled:text-zinc-600 text-zinc-900 font-semibold rounded-2xl py-3.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu ODO mới
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
    try {
      await onSave({ partId: part.id, date, odo: Number(odo), cost: cost ? Number(cost) : 0, note });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Đã bảo dưỡng: ${part.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field icon={<Calendar className="w-4 h-4" />} label="Ngày thực hiện">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent w-full text-sm text-zinc-100 focus:outline-none" />
        </Field>
        <Field icon={<Gauge className="w-4 h-4" />} label="ODO lúc làm (km)">
          <input type="number" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} className="bg-transparent w-full text-sm text-zinc-100 focus:outline-none font-mono tabular-nums" />
        </Field>
        <Field icon={<Coins className="w-4 h-4" />} label="Chi phí (VNĐ, không bắt buộc)">
          <input type="number" inputMode="numeric" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} className="bg-transparent w-full text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-600" />
        </Field>
        <Field icon={<StickyNote className="w-4 h-4" />} label="Ghi chú / thương hiệu">
          <input type="text" placeholder="VD: Nhớt Repsol 10W40..." value={note} onChange={(e) => setNote(e.target.value)} className="bg-transparent w-full text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-600" />
        </Field>
      </div>
      {!isValid && (
        <p className="text-xs text-rose-400 mt-2">ODO lúc làm phải ≥ lần bảo dưỡng trước ({formatKm(part.last_service_odo)} km)</p>
      )}
      <button disabled={!isValid || saving} onClick={handleSubmit}
        className="w-full mt-5 bg-cyan-400 disabled:bg-white/10 disabled:text-zinc-600 text-zinc-900 font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Xác nhận đã bảo dưỡng
      </button>
    </ModalShell>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{icon} {label}</div>
      {children}
    </div>
  );
}