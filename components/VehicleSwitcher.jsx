"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Bike, Plus, Pencil } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * VehicleSwitcher — dropdown chuyển xe + thêm xe mới + sửa xe đang chọn.
 * LUÔN hiển thị (kể cả khi chỉ có 1 xe) vì giờ đây còn dùng để "Thêm xe" / "Sửa xe".
 *
 * Props:
 *  - vehicles: mảng xe của user (từ fetchVehicles())
 *  - activeVehicle: xe đang chọn
 *  - onSwitch(vehicleId)
 *  - onAddVehicle()   -> mở modal thêm xe (xử lý ở page.jsx)
 *  - onEditVehicle(vehicle) -> mở modal sửa xe được chọn
 */
export default function VehicleSwitcher({ vehicles, activeVehicle, onSwitch, onAddVehicle, onEditVehicle }) {
  const [open, setOpen] = useState(false);

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
          <div className="absolute right-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-40 overflow-hidden">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <button
                  onClick={() => {
                    vibrate(10);
                    onSwitch(v.id);
                    setOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2.5 px-3.5 py-3 text-left min-w-0"
                >
                  <Bike className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text)] truncate">{v.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {v.current_odo.toLocaleString("vi-VN")} km
                    </div>
                  </div>
                  {v.id === activeVehicle?.id && <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />}
                </button>
                <button
                  onClick={() => {
                    vibrate(10);
                    onEditVehicle(v);
                    setOpen(false);
                  }}
                  className="w-9 h-9 flex items-center justify-center shrink-0 mr-1.5"
                  title="Sửa thông tin xe"
                >
                  <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                vibrate(10);
                onAddVehicle();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left border-t border-[var(--border)] text-[var(--accent)]"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Thêm xe mới</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}