const VG_SW_VERSION = 'push-json-v5';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function parseJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePushPayload(rawPayload) {
  const cleanRawPayload = String(rawPayload || '').replace(/[\u0000-\u001f]+$/g, '').trim();
  let payload = { title: 'VideoGrace', body: cleanRawPayload, url: './' };
  const parsed = parseJsonObject(cleanRawPayload);

  if (parsed) {
    payload = {
      ...payload,
      ...parsed,
    };
  }

  if (payload.notification && typeof payload.notification === 'object') {
    payload = {
      ...payload,
      ...payload.notification,
    };
  }

  if (payload.data && typeof payload.data === 'object') {
    payload = {
      ...payload,
      ...payload.data,
    };
  }

  for (let i = 0; i < 2; i += 1) {
    if (typeof payload.body !== 'string') {
      payload.body = '';
      break;
    }

    const nested = parseJsonObject(payload.body.trim());
    if (!nested) {
      break;
    }

    payload = {
      ...payload,
      ...nested,
    };
  }

  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    payload.title = 'VideoGrace';
  }

  if (typeof payload.body !== 'string') {
    payload.body = '';
  }

  if (payload.body.trim().startsWith('{')) {
    payload.body = 'Новое событие';
  }

  return payload;
}

self.addEventListener('push', (event) => {
  const rawPayload = event.data?.text?.() || '';
  const payload = normalizePushPayload(rawPayload);

  event.waitUntil(
    self.registration.showNotification(payload.title || 'VideoGrace', {
      body: payload.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { ...payload, swVersion: VG_SW_VERSION },
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

    const client =
      clientList.find((entry) => entry.url.startsWith(targetUrl)) ||
      clientList.find((entry) => entry.url.startsWith(self.registration.scope)) ||
      clientList[0];

    if (client) {
      if ('navigate' in client && !client.url.startsWith(targetUrl)) {
        await client.navigate(targetUrl);
      }
      if ('focus' in client) {
        await client.focus();
      }

      client.postMessage({
        type: 'notification_click',
        data: event.notification.data || null,
      });

      return;
    }

    const opened = await clients.openWindow(targetUrl);
    if (!opened && targetUrl !== self.registration.scope) {
      await clients.openWindow(self.registration.scope);
    }
  })());
});
