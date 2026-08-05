// lib/offlineCache.js
// Lưu bản sao gần nhất của (vehicle + parts) vào localStorage mỗi khi fetch
// thành công. Khi mất mạng (VD: trong hầm xe), app đọc lại cache này thay vì
// hiện màn hình lỗi trắng — đúng yêu cầu "vẫn xem được số km bảo dưỡng gần nhất".

const CACHE_KEY = "motocare_cache";

export function saveCache({ vehicle, parts }) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ vehicle, parts, cachedAt: new Date().toISOString() })
    );
  } catch {
    // localStorage đầy hoặc bị chặn (chế độ duyệt riêng tư) — bỏ qua, không critical
  }
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}