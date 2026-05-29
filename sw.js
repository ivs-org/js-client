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
  const rawPayload = event.data?.text?.() || '';
  let payload = { title: 'VideoGrace', body: rawPayload, url: './' };
  try {
    const parsed = rawPayload ? JSON.parse(rawPayload) : null;
    if (parsed && typeof parsed === 'object') {
      payload = {
        ...payload,
        ...parsed,
      };
    }
  } catch {
    // Plain text pushes are still supported for compatibility.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'VideoGrace', {
      body: payload.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: payload,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const payloadUrl = event.notification.data?.url || './';
  const targetUrl = new URL(payloadUrl, self.registration.scope).href;

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
