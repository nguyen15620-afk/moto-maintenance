// lib/partStatus.js
// Tách từ app/page.jsx để dùng chung giữa Dashboard chính và trang Tổng quan (/overview).

export const DAY_MS = 1000 * 60 * 60 * 24;

/** Tính ODO ước tính hôm nay (xem giải thích chi tiết trong app/page.jsx gốc) */
export function getEstimatedOdo(vehicle) {
  if (!vehicle) return { estimatedOdo: 0, daysSinceUpdate: 0 };
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(vehicle.odo_updated_at).getTime()) / DAY_MS
  );
  const safeDays = Math.max(daysSinceUpdate, 0);
  const avg = vehicle.avg_km_per_day || 0;
  return {
    estimatedOdo: vehicle.current_odo + avg * safeDays,
    daysSinceUpdate: safeDays,
  };
}

export function computePartStatus(part, currentOdo) {
  const today = new Date();
  const kmSince = currentOdo - part.last_service_odo;
  const daysSince = Math.floor((today.getTime() - new Date(part.last_service_date).getTime()) / DAY_MS);
  const kmRatio = part.interval_km ? kmSince / part.interval_km : null;
  const monthsRatio = part.interval_months ? daysSince / (part.interval_months * 30) : null;
  const ratios = [kmRatio, monthsRatio].filter((r) => r !== null);
  const usedRatio = Math.max(...ratios);

  const remainingKm = part.interval_km ? part.interval_km - kmSince : null;
  const remainingDaysByTime = part.interval_months ? part.interval_months * 30 - daysSince : null;

  let status = "green";
  if (usedRatio >= 1) status = "red";
  else if (usedRatio >= 0.8) status = "yellow";

  return { usedRatio: Math.min(usedRatio, 1.3), status, remainingKm, remainingDaysByTime };
}

export const STATUS_CONFIG = {
  red: { label: "Quá hạn", text: "text-[var(--danger-text)]", bg: "bg-[var(--danger-bg)]", chip: "bg-[var(--danger-bg)]/10 text-[var(--danger-text)] border-[var(--danger-bg)]/30" },
  yellow: { label: "Sắp đến hạn", text: "text-[var(--warn-text)]", bg: "bg-[var(--warn-bg)]", chip: "bg-[var(--warn-bg)]/10 text-[var(--warn-text)] border-[var(--warn-bg)]/30" },
  green: { label: "An toàn", text: "text-[var(--good-text)]", bg: "bg-[var(--good-bg)]", chip: "bg-[var(--good-bg)]/10 text-[var(--good-text)] border-[var(--good-bg)]/30" },
};