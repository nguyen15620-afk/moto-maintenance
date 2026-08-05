"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Bike } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * VehicleSwitcher — dropdown đơn giản để chuyển giữa các xe (2-3 xe).
 * Props:
 *  - vehicles: mảng xe của user (từ fetchVehicles())
 *  - activeVehicle: xe đang chọn
 *  - onSwitch: callback(vehicleId) khi user chọn xe khác
 */
export default function VehicleSwitcher({ vehicles, activeVehicle, onSwitch }) {
  const [open, setOpen] = useState(false);

  if (!vehicles || vehicles.length <= 1) return null; // chỉ 1 xe -> không cần hiện

  return (
    <div className="relative">
      <button
        onClick={() => {
          vibrate(10);
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1 text-xs text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2.5 py-1"
      >
        Đổi xe <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-40 overflow-hidden">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  vibrate(10);
                  onSwitch(v.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <Bike className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--text)] truncate">{v.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {v.current_odo.toLocaleString("vi-VN")} km
                  </div>
                </div>
                {v.id === activeVehicle?.id && <Check className="w-4 h-4 text-[var(--accent)]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}