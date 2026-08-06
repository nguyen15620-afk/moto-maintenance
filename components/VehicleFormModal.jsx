"use client";

import React, { useState } from "react";
import { X, Loader2, Bike } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * VehicleFormModal — dùng chung cho 2 việc:
 *  - mode="add": thêm xe mới (currentOdo nhập tay lần đầu)
 *  - mode="edit": sửa tên/hãng/dòng xe/biển số của xe đang chọn (không sửa ODO ở đây,
 *    ODO có modal "Cập nhật ODO" riêng ở trang chính)
 *
 * Props:
 *  - mode: "add" | "edit"
 *  - initialValues: { name, brand, model, plateNumber, currentOdo } (dùng khi edit)
 *  - onClose, onSave(values)
 */
export default function VehicleFormModal({ mode = "add", initialValues = {}, onClose, onSave }) {
  const [name, setName] = useState(initialValues.name || "");
  const [brand, setBrand] = useState(initialValues.brand || "");
  const [model, setModel] = useState(initialValues.model || "");
  const [plateNumber, setPlateNumber] = useState(initialValues.plateNumber || "");
  const [currentOdo, setCurrentOdo] = useState(String(initialValues.currentOdo ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim().length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(),
        brand: brand.trim(),
        model: model.trim(),
        plateNumber: plateNumber.trim(),
        currentOdo: mode === "add" ? Number(currentOdo) || 0 : undefined,
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
            <Bike className="w-4 h-4 text-[var(--accent)]" />
            {mode === "add" ? "Thêm xe mới" : "Sửa thông tin xe"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <TextField label="Tên xe (bắt buộc)" placeholder="VD: Honda Vario của tôi" value={name} onChange={setName} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Hãng xe" placeholder="Honda" value={brand} onChange={setBrand} />
            <TextField label="Dòng xe" placeholder="Vario 125" value={model} onChange={setModel} />
          </div>
          <TextField label="Biển số" placeholder="59-P1 234.56" value={plateNumber} onChange={setPlateNumber} />

          {mode === "add" && (
            <TextField
              label="ODO hiện tại (km)"
              placeholder="0"
              value={currentOdo}
              onChange={setCurrentOdo}
              type="number"
              inputMode="numeric"
            />
          )}

          {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full mt-2 bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Thêm xe" : "Lưu thay đổi"}
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