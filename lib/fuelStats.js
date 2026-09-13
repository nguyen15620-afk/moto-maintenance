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
 * predictNextRefill — dự đoán mốc ODO nên đổ xăng tiếp theo.
 *
 * Cách cũ (bị lỗi): lấy trung bình quãng đường giữa các lần đổ liên tiếp.
 * → Nếu user đổ sớm theo cảnh báo (chưa hết bình), khoảng cách ngắn hơn bị
 *   kéo trung bình xuống → cảnh báo ngày càng sớm hơn (feedback loop).
 *
 * Cách mới: dùng mức tiêu thụ trung bình (L/100km) + dung tích bình ước tính
 * (lần đổ nhiều nhất gần đây ≈ gần hết bình mới đổ đầy) để tính quãng đường
 * thực sự 1 bình đầy có thể đi được. Cách này không bị ảnh hưởng bởi việc
 * user đổ sớm hay muộn.
 *
 * safetyRatio (mặc định 0.85): đề xuất đổ khi mới dùng hết 85% quãng đường
 * ước tính của 1 bình — chừa đệm an toàn, tránh hết xăng dọc đường.
 */
export function predictNextRefill(logs, safetyRatio = 0.85) {
  const points = buildConsumptionPoints(logs);
  if (points.length < 2) return null; // cần ít nhất 3 lần đổ để có đủ dữ liệu

  // Lấy tối đa 5 điểm gần nhất để tính trung bình tiêu thụ (L/100km)
  const recent = points.slice(-5);
  const avgConsumption =
    recent.reduce((s, p) => s + p.consumption, 0) / recent.length; // L/100km

  // Ước tính dung tích bình ≈ lần đổ nhiều lít nhất trong 5 lần gần đây
  // (khi gần hết bình mới đổ đầy → số lít đổ ≈ dung tích thực tế)
  const recentLogs = logs.slice(-6); // lấy 6 logs cuối (tương ứng 5 khoảng)
  const estimatedTankCapacity = Math.max(...recentLogs.map((l) => l.liters));

  // Quãng đường 1 bình đầy = (dung tích / L_per_100km) × 100
  const fullTankRange = (estimatedTankCapacity / avgConsumption) * 100;

  const lastFill = logs[logs.length - 1];
  const suggestedOdo = Math.round(lastFill.odo_at_fill + fullTankRange * safetyRatio);
  const emptyOdo = Math.round(lastFill.odo_at_fill + fullTankRange);

  return {
    avgRange: Math.round(fullTankRange),
    avgConsumption: Math.round(avgConsumption * 100) / 100,
    lastFillOdo: lastFill.odo_at_fill,
    suggestedOdo,
    emptyOdo,
  };
}