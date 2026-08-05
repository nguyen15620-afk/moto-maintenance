// lib/haptics.js
// iOS Safari (kể cả khi đã Add to Home Screen) hỗ trợ Navigator.vibrate()
// rất hạn chế — hầu hết các bản iOS KHÔNG rung được qua Web API vì lý do
// bảo mật/pin của Apple. Hàm này vẫn được viết chuẩn để:
//  - Hoạt động đầy đủ trên Android Chrome/PWA.
//  - Tự động "no-op" (không lỗi) trên iOS — vuốt nhẹ trải nghiệm không vỡ.
//  - Nếu Apple mở API trong tương lai, code không cần sửa gì thêm.

export function vibrate(pattern = 15) {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // im lặng bỏ qua — không để lỗi rung làm gián đoạn thao tác chính
  }
}