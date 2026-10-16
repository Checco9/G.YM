/* Service worker di G.YM: riceve le notifiche push e apre l'app al tocco. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // Ogni push deve mostrare una notifica (su iPhone, altrimenti il browser revoca l'iscrizione).
  event.waitUntil(
    self.registration.showNotification(data.title || "G.YM", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* il browser può rifiutare la navigazione: l'app resta comunque in primo piano */
            }
          }
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
