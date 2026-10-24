// lib/dates.js
// Ngày hôm nay dạng "YYYY-MM-DD" theo GIỜ MÁY người dùng.
// Không dùng new Date().toISOString().slice(0, 10) vì đó là ngày theo UTC —
// ở Việt Nam (UTC+7), từ 0h đến 7h sáng sẽ ra ngày hôm qua.

export function todayLocal() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
