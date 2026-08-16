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

/**
 * predictNextRefill — dự đoán mốc ODO nên đổ xăng tiếp theo, dựa trên quãng
 * đường trung bình đi được giữa các lần đổ ĐẦY BÌNH gần đây. Giả định người
 * dùng chỉ ghi log khi đổ đầy (đã nhắc sẵn trong FuelFormModal), nên khoảng
 * cách ODO giữa 2 lần đổ liên tiếp ≈ quãng đường đi được với 1 bình đầy.
 *
 * safetyRatio (mặc định 0.85): đề xuất đổ khi mới dùng hết 85% quãng đường
 * trung bình của 1 bình — chừa đệm an toàn, tránh hết xăng dọc đường.
 */
export function predictNextRefill(logs, safetyRatio = 0.85) {
  const points = buildConsumptionPoints(logs);
  if (points.length < 2) return null; // cần ít nhất 3 lần đổ để có 2 khoảng cách để lấy trung bình

  const recentDistances = points.slice(-5).map((p) => p.distance);
  const avgRange = recentDistances.reduce((s, d) => s + d, 0) / recentDistances.length;

  const lastFill = logs[logs.length - 1];
  const suggestedOdo = Math.round(lastFill.odo_at_fill + avgRange * safetyRatio);
  const emptyOdo = Math.round(lastFill.odo_at_fill + avgRange);

  return { avgRange: Math.round(avgRange), lastFillOdo: lastFill.odo_at_fill, suggestedOdo, emptyOdo };
}