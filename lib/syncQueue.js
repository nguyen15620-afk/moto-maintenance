// lib/syncQueue.js
// Hàng đợi đồng bộ cho các thao tác GHI dữ liệu khi mất mạng (Cập nhật ODO,
// Đánh dấu "Đã làm", Ghi đổ xăng). Lưu trong localStorage, xử lý tuần tự theo
// đúng thứ tự thao tác khi có mạng trở lại.

const QUEUE_KEY = "motocare_sync_queue";

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage đầy/bị chặn -> bỏ qua, không critical (giống offlineCache.js)
  }
}

export function enqueue(type, payload) {
  const queue = getQueue();
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  queue.push(item);
  saveQueue(queue);
  return item;
}

export function removeFromQueue(id) {
  saveQueue(getQueue().filter((i) => i.id !== id));
}

function updateQueueItem(id, patch) {
  const queue = getQueue();
  const idx = queue.findIndex((i) => i.id === id);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...patch };
  saveQueue(queue);
}

/**
 * isLikelyNetworkError — phân biệt lỗi MẠNG (nên xếp hàng, thử lại sau) với
 * lỗi THẬT (validate sai, RLS chặn...) — lỗi thật phải báo ngay, không được
 * âm thầm giữ trong hàng đợi khiến người dùng tưởng đã lưu thành công.
 */
export function isLikelyNetworkError(err) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") || // thông báo lỗi mạng đặc trưng của Safari
    err?.name === "TypeError"      // fetch() lỗi mạng thường ném TypeError
  );
}

/**
 * processQueue — chạy tuần tự từng item. Gặp lỗi MẠNG thì dừng ngay và giữ
 * nguyên thứ tự hàng đợi (thử lại sau); gặp lỗi THẬT thì đánh dấu lỗi trên
 * item đó nhưng vẫn tiếp tục các item còn lại, để 1 item lỗi không chặn
 * đứng toàn bộ hàng đợi.
 */
export async function processQueue(handlers) {
  const queue = getQueue();
  let syncedCount = 0;
  for (const item of queue) {
    const handler = handlers[item.type];
    if (!handler) {
      removeFromQueue(item.id); // loại bỏ item với type không xác định (an toàn khi đổi code sau này)
      continue;
    }
    try {
      await handler(item.payload);
      removeFromQueue(item.id);
      syncedCount++;
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        return { stopped: true, syncedCount }; // còn mất mạng -> dừng, thử lại sau
      }
      updateQueueItem(item.id, {
        attempts: (item.attempts || 0) + 1,
        lastError: err?.message || "Lỗi không xác định",
      });
    }
  }
  return { stopped: false, syncedCount };
}