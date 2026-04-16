self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const body = event.data?.text?.() || '';
  event.waitUntil(
    self.registration.showNotification('VideoGrace', {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL('./', self.registration.scope).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    const client = clientList.find((entry) => entry.url.startsWith(targetUrl)) || clientList[0];

    if (client) {
      if ('focus' in client) {
        await client.focus();
      }

      client.postMessage({
        type: 'notification_click',
        data: event.notification.data || null,
      });

      return;
    }

    await clients.openWindow(targetUrl);
  })());
});
