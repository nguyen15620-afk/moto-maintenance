"use client";

import React, { useMemo, useState } from "react";
import { Fuel, Plus, Pencil, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import { vibrate } from "@/lib/haptics";

const formatDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatKm = (n) => n.toLocaleString("vi-VN");

// Các nguyên nhân thường gặp khi xe hao xăng bất thường — sắp theo mức độ
// phổ biến/dễ tự kiểm tra trước (áp suất lốp là nguyên nhân #1, ai cũng
// tự kiểm tra được; cảm biến oxy/kim phun cần thợ nên để cuối).
const ANOMALY_CHECKLIST = [
  "Áp suất lốp — lốp non hơi làm tăng ma sát lăn, hao xăng rõ rệt",
  "Lọc gió bẩn/tắc — hỗn hợp khí-xăng không đủ oxy, đốt không hết",
  "Bugi mòn/bẩn — đánh lửa yếu, xăng cháy không trọn vẹn",
  "Phanh bó (đĩa/căm cạ vào bố thắng) — xe ì, phải ga nhiều hơn bình thường",
  "Dầu nhớt quá hạn hoặc sai loại — tăng ma sát trong động cơ",
  "Kim phun/chế hoà khí bẩn — với xe đời cũ hoặc lâu chưa bảo dưỡng",
  "Cảm biến oxy (với xe phun xăng điện tử) — báo sai làm ECU bơm dư xăng",
  "Thói quen lái gần đây — chở nặng hơn, đi phố kẹt xe nhiều, tăng giảm ga gấp",
];

/** Tính L/100km giữa các lần đổ liên tiếp (bỏ qua cặp có ODO không tăng — dữ liệu nhập sai) */
function buildConsumptionPoints(logs) {
  const points = [];
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1];
    const cur = logs[i];
    const distance = cur.odo_at_fill - prev.odo_at_fill;
    if (distance <= 0) continue;
    const consumption = (cur.liters / distance) * 100;
    points.push({ id: cur.id, date: cur.fill_date, distance, liters: cur.liters, consumption });
  }
  return points;
}

/** So lần đổ mới nhất với trung bình tối đa 5 lần trước đó */
function detectAnomaly(points) {
  if (points.length < 3) return { status: "insufficient" };
  const latest = points[points.length - 1];
  const baseline = points.slice(0, -1).slice(-5);
  const avg = baseline.reduce((s, p) => s + p.consumption, 0) / baseline.length;
  const ratio = latest.consumption / avg;
  let status = "green";
  if (ratio >= 1.3) status = "red";
  else if (ratio >= 1.15) status = "yellow";
  return { status, latest, avg, ratio };
}

/**
 * FuelSection — nhật ký đổ xăng + cảnh báo tiêu thụ bất thường.
 * Props: fuelLogs (mảng, sắp ODO tăng dần), onAdd(), onEdit(log), onDelete(logId)
 */
export default function FuelSection({ fuelLogs, onAdd, onEdit, onDelete }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const points = useMemo(() => buildConsumptionPoints(fuelLogs), [fuelLogs]);
  const anomaly = useMemo(() => detectAnomaly(points), [points]);
  const recentAvg = useMemo(() => {
    const last5 = points.slice(-5);
    if (!last5.length) return null;
    return last5.reduce((s, p) => s + p.consumption, 0) / last5.length;
  }, [points]);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
          <Fuel className="w-4 h-4" /> Mức tiêu thụ xăng
        </h2>
        <button onClick={() => { vibrate(10); onAdd(); }} className="text-xs text-[var(--accent)] flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Ghi đổ xăng
        </button>
      </div>

      {fuelLogs.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có lần đổ xăng nào được ghi lại.</p>
      )}

      {fuelLogs.length > 0 && fuelLogs.length < 2 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          Cần thêm ít nhất 1 lần đổ nữa để bắt đầu tính mức tiêu thụ.
        </p>
      )}

      {recentAvg !== null && (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5 mb-3 flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <div>
            <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent)]">
              {recentAvg.toFixed(2)} <span className="text-xs text-[var(--text-muted)] font-normal">L/100km</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">Trung bình {Math.min(points.length, 5)} lần đổ gần nhất</div>
          </div>
        </div>
      )}

      {(anomaly.status === "yellow" || anomaly.status === "red") && (
        <div className={`rounded-2xl border p-3.5 mb-3 ${
          anomaly.status === "red"
            ? "bg-[var(--danger-bg)]/10 border-[var(--danger-bg)]/30"
            : "bg-[var(--warn-bg)]/10 border-[var(--warn-bg)]/30"
        }`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${anomaly.status === "red" ? "text-[var(--danger-text)]" : "text-[var(--warn-text)]"}`} />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${anomaly.status === "red" ? "text-[var(--danger-text)]" : "text-[var(--warn-text)]"}`}>
                {anomaly.status === "red" ? "Xe đang hao xăng bất thường" : "Mức tiêu thụ đang tăng nhẹ"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Lần đổ gần nhất: <b>{anomaly.latest.consumption.toFixed(2)} L/100km</b>, cao hơn khoảng{" "}
                <b>{Math.round((anomaly.ratio - 1) * 100)}%</b> so với trung bình ({anomaly.avg.toFixed(2)} L/100km).
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Nên kiểm tra:</p>
              <ul className="text-xs text-[var(--text-muted)] mt-1 space-y-1 list-disc list-inside">
                {ANOMALY_CHECKLIST.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {[...fuelLogs].reverse().map((log) => {
          const point = points.find((p) => p.id === log.id);
          return (
            <div key={log.id} className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {formatDateVN(log.fill_date)}
                    {log.pending && (
                      <span className="text-[9px] uppercase tracking-wide bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full">
                        Chờ đồng bộ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {formatKm(log.odo_at_fill)} km · {log.liters} lít
                    {point && <> · <span className="text-[var(--accent)] font-medium">{point.consumption.toFixed(2)} L/100km</span></>}
                  </div>
                  {log.station && <div className="text-xs text-[var(--text-muted)] mt-0.5">{log.station}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { vibrate(10); onEdit(log); }} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  {confirmDeleteId === log.id ? (
                    <button
                      onClick={() => { onDelete(log.id); setConfirmDeleteId(null); }}
                      className="h-8 px-2.5 rounded-full bg-[var(--danger-bg)] text-white text-xs font-medium whitespace-nowrap"
                    >
                      Xoá luôn?
                    </button>
                  ) : (
                    <button
                      onClick={() => { vibrate(10); setConfirmDeleteId(log.id); setTimeout(() => setConfirmDeleteId((id) => (id === log.id ? null : id)), 3000); }}
                      className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[var(--danger-text)]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}