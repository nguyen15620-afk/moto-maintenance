// lib/fuelStats.js
// Tách từ components/FuelSection.jsx để dùng chung với trang Tổng quan (/overview).

/** Tính L/100km giữa các lần đổ liên tiếp (bỏ qua cặp có ODO không tăng — dữ liệu nhập sai) */
export function buildConsumptionPoints(logs) {
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