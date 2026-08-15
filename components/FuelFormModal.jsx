"use client";

import React, { useState } from "react";
import { X, Loader2, Fuel, Calendar, Gauge, Coins, MapPin, StickyNote, ChevronDown } from "lucide-react";
import { vibrate } from "@/lib/haptics";

// Chuẩn hoá chuỗi số thập phân người dùng gõ: cho phép cả dấu phẩy (,) lẫn
// dấu chấm (.) làm dấu thập phân — bàn phím số tiếng Việt trên nhiều máy
// Android dùng dấu phẩy, nhưng <input type="number"> của HTML CHỈ chấp nhận
// dấu chấm nên gõ dấu phẩy bị trình duyệt âm thầm từ chối (tưởng như không
// gõ được số lẻ). Dùng input type="text" + hàm lọc này để tránh vấn đề đó.
function sanitizeDecimalInput(raw) {
  // Chỉ giữ lại chữ số và dấu phẩy/chấm
  let v = raw.replace(/[^0-9.,]/g, "");
  // Chỉ cho phép 1 dấu phân cách thập phân duy nhất (dấu đầu tiên gõ vào)
  const sepIndex = v.search(/[.,]/);
  if (sepIndex !== -1) {
    v = v.slice(0, sepIndex + 1) + v.slice(sepIndex + 1).replace(/[.,]/g, "");
  }
  return v;
}

/** Chuyển chuỗi đã sanitize (có thể chứa dấu phẩy) thành number thật để tính toán/lưu DB */
function toNumber(v) {
  if (!v) return 0;
  return Number(v.replace(",", "."));
}

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
  const [liters, setLiters] = useState(
    initialValues.liters !== undefined && initialValues.liters !== null ? String(initialValues.liters) : ""
  );
  const [totalCost, setTotalCost] = useState(initialValues.totalCost ? String(initialValues.totalCost) : "");
  const [station, setStation] = useState(initialValues.station || "");
  const [notes, setNotes] = useState(initialValues.notes || "");
  const [showMore, setShowMore] = useState(!!(initialValues.station || initialValues.notes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const litersValue = toNumber(liters);
  const odoInvalid = odoAtFill !== "" && Number(odoAtFill) < minOdo;
  const isValid = Number(odoAtFill) >= minOdo && litersValue > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        fillDate,
        odoAtFill: Number(odoAtFill),
        liters: litersValue,
        totalCost: totalCost ? toNumber(totalCost) : null,
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
      <div className="relative w-full max-w-md bg-[var(--surface)] border-t border-[var(--border)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-h-[90vh] overflow-y-auto">
        <div className="w-9 h-1 bg-black/10 dark:bg-white/15 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-[var(--accent)]" />
            {initialValues.fillDate ? "Sửa lần đổ xăng" : "Ghi lần đổ xăng"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" aria-label="Đóng">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] mb-3">
          ⚠️ Chỉ nhập lần <b>đổ đầy bình</b> để mức tiêu thụ tính chính xác.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Số lít — trường quan trọng nhất, làm nổi bật giống ô nhập ODO ở trang chính */}
          <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3.5 py-2.5">
            <label className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1 block">
              Số lít đổ
            </label>
            <div className="flex items-baseline gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                value={liters}
                onChange={(e) => setLiters(sanitizeDecimalInput(e.target.value))}
                className="bg-transparent w-full font-mono tabular-nums text-3xl font-bold text-[var(--accent)] focus:outline-none placeholder:text-[var(--text-muted)]/50"
              />
              <span className="text-sm text-[var(--text-muted)] shrink-0">lít</span>
            </div>
          </div>

          {/* Ngày + ODO gộp 1 hàng cho gọn */}
          <div className="grid grid-cols-2 gap-3">
            <Field icon={<Calendar className="w-4 h-4" />} label="Ngày đổ">
              <input type="date" value={fillDate} onChange={(e) => setFillDate(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
            </Field>
            <Field icon={<Gauge className="w-4 h-4" />} label="ODO lúc đổ">
              <input
                type="number"
                inputMode="numeric"
                value={odoAtFill}
                onChange={(e) => setOdoAtFill(e.target.value)}
                className="bg-transparent w-full text-sm focus:outline-none font-mono tabular-nums"
              />
            </Field>
          </div>
          {odoInvalid && (
            <p className="text-xs text-[var(--danger-text)] -mt-1">
              ODO phải ≥ lần đổ trước ({minOdo.toLocaleString("vi-VN")} km)
            </p>
          )}

          <Field icon={<Coins className="w-4 h-4" />} label="Tổng tiền (VNĐ, không bắt buộc)">
            <input type="number" inputMode="numeric" placeholder="0" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
          </Field>

          {/* Trạm xăng + Ghi chú — ẩn mặc định để form gọn hơn */}
          {!showMore ? (
            <button
              type="button"
              onClick={() => { vibrate(10); setShowMore(true); }}
              className="w-full flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] py-1.5"
            >
              Thêm chi tiết (trạm xăng, ghi chú) <ChevronDown className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <Field icon={<MapPin className="w-4 h-4" />} label="Trạm xăng (không bắt buộc)">
                <input type="text" placeholder="VD: Petrolimex..." value={station} onChange={(e) => setStation(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
              </Field>
              <Field icon={<StickyNote className="w-4 h-4" />} label="Ghi chú (không bắt buộc)">
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
              </Field>
            </>
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