// Service Worker.
// Capacitor 네이티브 환경에선 SW 가 capacitor:// 스킴 fetch 를 가로채면서
// navigate 요청이 잘못된 페이지(랜딩)로 빠지는 사고가 있었음. 이에 대응해
// Capacitor 환경이면 자기 자신을 unregister 하고 모든 fetch 를 pass-through.

const CACHE_NAME = "yeon-v3";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/saju-input",
  "/icon-192x192.svg",
  "/icon-512x512.svg",
];

const IS_CAPACITOR = self.location.protocol === "capacitor:";

// 설치 — Capacitor 면 캐시 안 만들고 즉시 skipWaiting
self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (IS_CAPACITOR) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 활성화
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      if (IS_CAPACITOR) {
        // Capacitor: 자기 자신 unregister + 캐시 전부 삭제
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
          await self.registration.unregister();
        } catch (err) {
          console.error("[SW] capacitor self-cleanup 실패:", err);
        }
        // 컨트롤 중인 모든 client 에 reload 요청 — 다음 navigation 부턴 SW 없이.
        try {
          const all = await self.clients.matchAll({ includeUncontrolled: true });
          for (const client of all) {
            if ("navigate" in client) {
              client.navigate(client.url).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
        return;
      }
      // 웹: 이전 버전 캐시만 삭제
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })()
  );
});

// fetch — Capacitor 면 가로채지 않고 pass-through
self.addEventListener("fetch", (event) => {
  if (IS_CAPACITOR) return;

  const { request } = event;

  // API 요청은 캐시하지 않음
  if (request.url.includes("/api/")) return;

  // POST 요청은 캐시하지 않음
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환. 캐시도 없으면 503.
        // 과거에 navigate 요청을 무조건 "/" 로 보내는 fallback 이 있었으나,
        // 정적 export + Capacitor 환경에서 SW 가 fetch 가로채는 케이스에 잘못된
        // 페이지로 빠지게 만들어 제거.
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// 푸시 알림 수신
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icon-192x192.svg",
      badge: "/icon-192x192.svg",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/home",
      },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
  event.waitUntil(clients.openWindow(url));
});
