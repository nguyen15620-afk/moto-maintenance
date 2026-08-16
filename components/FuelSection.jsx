"use client";

import React, { useMemo, useState } from "react";
import { Fuel, Plus, Pencil, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import { vibrate } from "@/lib/haptics";
import { buildConsumptionPoints, predictNextRefill } from "@/lib/fuelStats";

const formatDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatKm = (n) => n.toLocaleString("vi-VN");
const formatShortDate = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

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

/** Màu cột trong biểu đồ xu hướng — so với mức trung bình các cột đang hiển thị,
 * dùng chung ngưỡng với detectAnomaly() ở trên để nhất quán trong toàn section. */
function trendBarColor(consumption, avg) {
  if (!avg) return "bg-[var(--accent)]";
  const ratio = consumption / avg;
  if (ratio >= 1.3) return "bg-[var(--danger-bg)]";
  if (ratio >= 1.15) return "bg-[var(--warn-bg)]";
  return "bg-[var(--accent)]";
}

/**
 * FuelSection — nhật ký đổ xăng + cảnh báo tiêu thụ bất thường.
 * Props: fuelLogs (mảng, sắp ODO tăng dần), onAdd(), onEdit(log), onDelete(logId)
 */
export default function FuelSection({ fuelLogs, currentOdo, onAdd, onEdit, onDelete }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const points = useMemo(() => buildConsumptionPoints(fuelLogs), [fuelLogs]);
  const anomaly = useMemo(() => detectAnomaly(points), [points]);
  const recentAvg = useMemo(() => {
    const last5 = points.slice(-5);
    if (!last5.length) return null;
    return last5.reduce((s, p) => s + p.consumption, 0) / last5.length;
  }, [points]);

  const trendPoints = useMemo(() => points.slice(-10), [points]);
  const trendMax = useMemo(
    () => Math.max(...trendPoints.map((p) => p.consumption), 0.01),
    [trendPoints]
  );
  const trendAvg = useMemo(() => {
    if (!trendPoints.length) return 0;
    return trendPoints.reduce((s, p) => s + p.consumption, 0) / trendPoints.length;
  }, [trendPoints]);

  const prediction = useMemo(() => predictNextRefill(fuelLogs), [fuelLogs]);
  const predictionStatus = useMemo(() => {
    if (!prediction || currentOdo == null) return null;
    if (currentOdo >= prediction.emptyOdo) return "red";
    if (currentOdo >= prediction.suggestedOdo) return "yellow";
    return "green";
  }, [prediction, currentOdo]);

  return (
    <section>
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

      {prediction && currentOdo != null && (
        <div className={`rounded-2xl border p-3.5 mb-3 flex items-start gap-2.5 ${
          predictionStatus === "red"
            ? "bg-[var(--danger-bg)]/10 border-[var(--danger-bg)]/30"
            : predictionStatus === "yellow"
            ? "bg-[var(--warn-bg)]/10 border-[var(--warn-bg)]/30"
            : "bg-[var(--surface)] border-[var(--border)]"
        }`}>
          <Fuel className={`w-4 h-4 shrink-0 mt-0.5 ${
            predictionStatus === "red"
              ? "text-[var(--danger-text)]"
              : predictionStatus === "yellow"
              ? "text-[var(--warn-text)]"
              : "text-[var(--accent)]"
          }`} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${
              predictionStatus === "red"
                ? "text-[var(--danger-text)]"
                : predictionStatus === "yellow"
                ? "text-[var(--warn-text)]"
                : "text-[var(--text)]"
            }`}>
              {predictionStatus === "red"
                ? "Có thể sắp hết xăng — nên đổ ngay"
                : predictionStatus === "yellow"
                ? "Sắp tới lúc nên đổ xăng"
                : `Nên đổ xăng trước khi tới ~${formatKm(prediction.suggestedOdo)} km`}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {predictionStatus === "green"
                ? `Còn khoảng ${formatKm(Math.max(prediction.suggestedOdo - currentOdo, 0))} km nữa · `
                : `Mốc đề xuất: ${formatKm(prediction.suggestedOdo)} km · Ước tính gần hết bình: ~${formatKm(prediction.emptyOdo)} km · `}
              Dựa trên trung bình ~{formatKm(prediction.avgRange)} km/bình ({Math.min(points.length, 5)} lần đổ gần đây)
            </p>
          </div>
        </div>
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

      {trendPoints.length >= 2 && (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3.5 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Xu hướng tiêu thụ
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">{trendPoints.length} lần đổ gần nhất</span>
          </div>

          <div className="flex items-end gap-1.5 h-24">
            {trendPoints.map((p) => (
              <div key={p.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-full rounded-t-md transition-all ${trendBarColor(p.consumption, trendAvg)}`}
                  style={{ height: `${Math.max((p.consumption / trendMax) * 100, 6)}%` }}
                  title={`${formatShortDate(p.date)}: ${p.consumption.toFixed(2)} L/100km`}
                />
                <span className="text-[8px] text-[var(--text-muted)] truncate w-full text-center">
                  {formatShortDate(p.date)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
            <span>Trung bình: <b className="text-[var(--text)]">{trendAvg.toFixed(2)} L/100km</b></span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--warn-bg)]" /> +15%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--danger-bg)]" /> +30%</span>
            </span>
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
                  <button onClick={() => { vibrate(10); onEdit(log); }} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center" aria-label="Sửa lần đổ xăng">
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
                      aria-label="Xoá lần đổ xăng"
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