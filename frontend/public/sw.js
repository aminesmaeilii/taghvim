self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("zambil-shell-v1").then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icon.jpg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  const title = payload.title || "یادآوری جدید";
  const body = payload.privacyMode === "generic" ? "یک یادآوری جدید دارید" : payload.body;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icon.jpg",
    badge: "/icon.jpg",
    tag: payload.tag || payload.relatedEntityId || "zambil-notification",
    renotify: false,
    data: { url: payload.actionUrl || "/", notificationId: payload.notificationId, relatedEntityId: payload.relatedEntityId },
    actions: [
      { action: "view", title: "مشاهده" },
      { action: "snooze-10", title: "تعویق ۱۰ دقیقه‌ای" },
      { action: "snooze-60", title: "تعویق یک‌ساعته" },
    ],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      const url = event.notification.data?.url || "/";
      const existing = clientsList.find((client) => "focus" in client);
      if (existing) existing.postMessage({ type: "notification-click", action: event.action, url, notificationId: event.notification.data?.notificationId });
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
