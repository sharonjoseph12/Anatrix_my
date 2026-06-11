// apps/web/public/sw-push.js
// Web-push service worker for 002. Registered on the client when the user opts
// into push notifications. Receives pushes dispatched by supabase/functions/push-send.

self.addEventListener("push", (event) => {
  let payload = { title: "Antarix", body: "You have a new nudge." };
  try {
    if (event.data) payload = event.data.json();
  } catch { /* fall through to default payload */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: payload,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/ai-coach";
  event.waitUntil(self.clients.openWindow(target));
});
