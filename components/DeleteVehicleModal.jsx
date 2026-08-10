"use client";

import React, { useState } from "react";
import { X, Loader2, AlertTriangle, Bike } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * DeleteVehicleModal — xác nhận xoá xe. Đây là thao tác PHÁ HUỶ DỮ LIỆU
 * (xoá luôn parts/logs/fuel_logs liên quan qua cascade), nên dùng modal
 * cảnh báo rõ ràng thay vì double-tap nhanh như xoá 1 log lẻ.
 *
 * Props: vehicle { id, name }, onClose(), onConfirm() -> Promise
 */
export default function DeleteVehicleModal({ vehicle, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
      vibrate(200);
    } catch (err) {
      console.error(err);
      setError("Không xoá được. Thử lại sau.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={deleting ? undefined : onClose}
      />
      <div className="relative w-full max-w-md bg-[var(--surface)] border-t border-[var(--border)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="w-9 h-1 bg-black/10 dark:bg-white/15 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-1.5 text-[var(--danger-text)]">
            <AlertTriangle className="w-4 h-4" />
            Xoá xe
          </h3>
          <button
            onClick={onClose}
            disabled={deleting}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--danger-bg)]/10 border border-[var(--danger-bg)]/30 p-3.5 mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Bike className="w-4 h-4 text-[var(--danger-text)] shrink-0" />
            <span className="text-sm font-medium text-[var(--text)] truncate">{vehicle.name}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Thao tác này sẽ xoá{" "}
            <span className="text-[var(--danger-text)] font-medium">vĩnh viễn</span> toàn bộ
            dữ liệu của xe này: danh sách phụ tùng, lịch sử bảo dưỡng và nhật ký đổ xăng.
            Không thể hoàn tác.
          </p>
        </div>

        {error && <p className="text-xs text-[var(--danger-text)] mb-3">{error}</p>}

        <button
          disabled={deleting}
          onClick={handleConfirm}
          className="w-full bg-[var(--danger-bg)] disabled:opacity-50 text-white font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
          Xoá vĩnh viễn xe này
        </button>
        <button
          disabled={deleting}
          onClick={onClose}
          className="w-full mt-2 bg-black/5 dark:bg-white/5 text-[var(--text)] font-medium rounded-2xl py-3.5 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}