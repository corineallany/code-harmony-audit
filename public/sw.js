// Service Worker for ICC Le Mans — Web Push notifications
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "COM ICC Le Mans", body: event.data.text() };
  }

  const title = data.title || "COM ICC Le Mans";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { link: data.link || "/" },
    tag: data.tag || "icc-notification",
    renotify: !!data.tag,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Focus existing tab if on the same origin
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin)) {
          if ("focus" in client) {
            await client.focus();
            if (link && client.navigate) {
              await client.navigate(link);
            }
            return;
          }
        }
      }

      // Open new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(link);
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("install", () => {
  self.skipWaiting();
});
