// public/sw.js
// Service Worker đơn giản: cache các tài nguyên tĩnh (app shell) để load nhanh
// ở lần mở sau. KHÔNG cache API call tới Supabase — dữ liệu luôn phải mới nhất.

const CACHE_NAME = "motocare-cache-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Khi cài đặt: cache trước các tài nguyên tĩnh cơ bản
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Khi kích hoạt: xoá cache cũ nếu có version mới
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Chiến lược fetch: Network-first cho mọi request, fallback về cache khi mất mạng.
// Bỏ qua hoàn toàn các request tới Supabase (luôn đi thẳng ra network).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.hostname.includes("supabase.co")) {
    return; // không can thiệp — luôn lấy dữ liệu mới nhất
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});