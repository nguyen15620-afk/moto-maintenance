"use client";

import React, { useState } from "react";
import { X, Loader2, Fuel, Calendar, Gauge, Coins, MapPin, StickyNote } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * FuelFormModal — thêm/sửa 1 lần đổ xăng.
 * Props:
 *  - initialValues: { fillDate, odoAtFill, liters, totalCost, station, notes } (khi sửa)
 *  - minOdo: ODO lần đổ gần nhất trước đó — dùng validate ODO mới phải >= giá trị này
 *  - onClose, onSave(values)
 */
export default function FuelFormModal({ initialValues = {}, minOdo = 0, onClose, onSave }) {
  const [fillDate, setFillDate] = useState(initialValues.fillDate || new Date().toISOString().slice(0, 10));
  const [odoAtFill, setOdoAtFill] = useState(String(initialValues.odoAtFill ?? minOdo));
  const [liters, setLiters] = useState(initialValues.liters ? String(initialValues.liters) : "");
  const [totalCost, setTotalCost] = useState(initialValues.totalCost ? String(initialValues.totalCost) : "");
  const [station, setStation] = useState(initialValues.station || "");
  const [notes, setNotes] = useState(initialValues.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = Number(odoAtFill) >= minOdo && Number(liters) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        fillDate,
        odoAtFill: Number(odoAtFill),
        liters: Number(liters),
        totalCost: totalCost ? Number(totalCost) : null,
        station: station.trim(),
        notes: notes.trim(),
      });
      vibrate([10, 30, 10]);
    } catch (err) {
      console.error(err);
      setError("Không lưu được. Thử lại sau.");
      vibrate(200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface)] border-t border-[var(--border)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="w-9 h-1 bg-black/10 dark:bg-white/15 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-[var(--accent)]" />
            {initialValues.fillDate ? "Sửa lần đổ xăng" : "Ghi lần đổ xăng"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] mb-3">
          ⚠️ Chỉ nhập lần <b>đổ đầy bình</b> để mức tiêu thụ tính chính xác. Nếu đổ nửa bình, số liệu sẽ bị lệch.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field icon={<Calendar className="w-4 h-4" />} label="Ngày đổ">
            <input type="date" value={fillDate} onChange={(e) => setFillDate(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
          </Field>
          <Field icon={<Gauge className="w-4 h-4" />} label={`ODO lúc đổ (km) — tối thiểu ${minOdo.toLocaleString("vi-VN")}`}>
            <input type="number" inputMode="numeric" value={odoAtFill} onChange={(e) => setOdoAtFill(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none font-mono tabular-nums" />
          </Field>
          <Field icon={<Fuel className="w-4 h-4" />} label="Số lít đổ">
            <input type="number" inputMode="decimal" step="0.01" placeholder="VD: 3.5" value={liters} onChange={(e) => setLiters(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none font-mono tabular-nums placeholder:text-[var(--text-muted)]" />
          </Field>
          <Field icon={<Coins className="w-4 h-4" />} label="Tổng tiền (VNĐ, không bắt buộc)">
            <input type="number" inputMode="numeric" placeholder="0" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
          </Field>
          <Field icon={<MapPin className="w-4 h-4" />} label="Trạm xăng (không bắt buộc)">
            <input type="text" placeholder="VD: Petrolimex..." value={station} onChange={(e) => setStation(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
          </Field>
          <Field icon={<StickyNote className="w-4 h-4" />} label="Ghi chú (không bắt buộc)">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
          </Field>

          {!isValid && odoAtFill !== "" && Number(odoAtFill) < minOdo && (
            <p className="text-xs text-[var(--danger-text)]">ODO phải ≥ lần đổ trước ({minOdo.toLocaleString("vi-VN")} km)</p>
          )}
          {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full mt-2 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
          </button>
        </form>
      </div>
    </div>
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