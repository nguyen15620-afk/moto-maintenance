"use client";

import React, { useState } from "react";
import { X, Loader2, Wrench } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * PartFormModal — dùng chung 2 việc:
 *  - mode="add": thêm phụ tùng tuỳ ý (cần nhập luôn ODO/ngày bảo dưỡng gần nhất
 *    làm mốc khởi điểm để tính % hao mòn — vì phụ tùng mới chưa có log nào)
 *  - mode="edit": chỉ sửa tên + chu kỳ (KHÔNG sửa mốc ODO/ngày ở đây, việc đó
 *    do trigger DB tự tính lại từ lịch sử bảo dưỡng)
 *
 * Props:
 *  - mode: "add" | "edit"
 *  - initialValues: { name, intervalKm, intervalMonths, currentOdo } (currentOdo
 *    chỉ dùng làm giá trị gợi ý mặc định khi mode="add")
 *  - onClose, onSave(values)
 */
export default function PartFormModal({ mode = "add", initialValues = {}, onClose, onSave }) {
  const [name, setName] = useState(initialValues.name || "");
  const [intervalKm, setIntervalKm] = useState(initialValues.intervalKm ? String(initialValues.intervalKm) : "");
  const [intervalMonths, setIntervalMonths] = useState(initialValues.intervalMonths ? String(initialValues.intervalMonths) : "");
  const [lastServiceOdo, setLastServiceOdo] = useState(String(initialValues.currentOdo ?? 0));
  const [lastServiceDate, setLastServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasInterval = Number(intervalKm) > 0 || Number(intervalMonths) > 0;
  const isValid = name.trim().length > 0 && hasInterval;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(),
        intervalKm: intervalKm ? Number(intervalKm) : null,
        intervalMonths: intervalMonths ? Number(intervalMonths) : null,
        ...(mode === "add" ? { lastServiceOdo: Number(lastServiceOdo) || 0, lastServiceDate } : {}),
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
            <Wrench className="w-4 h-4 text-[var(--accent)]" />
            {mode === "add" ? "Thêm phụ tùng" : "Sửa phụ tùng"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" aria-label="Đóng">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <TextField label="Tên phụ tùng (bắt buộc)" placeholder="VD: Lọc gió, Dây curoa..." value={name} onChange={setName} autoFocus />

          <div className="grid grid-cols-2 gap-3">
            <TextField label="Chu kỳ (km)" placeholder="VD: 8000" value={intervalKm} onChange={setIntervalKm} type="number" inputMode="numeric" />
            <TextField label="Chu kỳ (tháng)" placeholder="VD: 6" value={intervalMonths} onChange={setIntervalMonths} type="number" inputMode="numeric" />
          </div>
          {!hasInterval && (name || intervalKm || intervalMonths) && (
            <p className="text-xs text-[var(--danger-text)]">Nhập ít nhất 1 trong 2 chu kỳ (km hoặc tháng)</p>
          )}

          {mode === "add" && (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="ODO lần cuối làm (km)" value={lastServiceOdo} onChange={setLastServiceOdo} type="number" inputMode="numeric" />
              <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3.5 py-2.5">
                <label className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1 block">Ngày làm lần cuối</label>
                <input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                  className="bg-transparent w-full text-sm text-[var(--text)] focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full mt-2 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Thêm phụ tùng" : "Lưu thay đổi"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", inputMode, autoFocus }) {
  return (
    <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3.5 py-2.5">
      <label className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1 block">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent w-full text-sm text-[var(--text)] focus:outline-none placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}