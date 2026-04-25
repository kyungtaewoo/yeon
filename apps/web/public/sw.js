const CACHE_NAME = "yeon-v2";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/saju-input",
  "/icon-192x192.svg",
  "/icon-512x512.svg",
];

// 설치 시 정적 자산 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화 시 이전 캐시 삭제
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 네트워크 우선, 실패 시 캐시 (Network First)
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // API 요청은 캐시하지 않음
  if (request.url.includes("/api/")) return;

  // POST 요청은 캐시하지 않음
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공한 응답은 캐시에 저장
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
