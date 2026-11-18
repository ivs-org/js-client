const VG_SW_VERSION = 'unread-badge-v11';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'APP_BADGE_UPDATE') {
    const { userId, unreadCount, readChatKeys } = event.data;
    if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(unreadCount) || unreadCount < 0) return;
    event.waitUntil(syncUnreadBadge(userId, unreadCount, Array.isArray(readChatKeys) ? readChatKeys : []));
  }
});

let badgeUpdates = Promise.resolve();

function updateAppBadge(count, afterUpdate) {
  badgeUpdates = badgeUpdates.then(async () => {
    try {
      if (count === 0 && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
      else if (count === undefined) await self.navigator.setAppBadge?.();
      else await self.navigator.setAppBadge?.(count);
    } catch {
      // Badge permission/support errors must never prevent push delivery.
    }
    await afterUpdate?.();
  }).catch(() => {});
  return badgeUpdates;
}

function syncUnreadBadge(userId, count, readChatKeys) {
  return updateAppBadge(count, async () => {
    const read = new Set(readChatKeys);
    const notifications = await self.registration.getNotifications().catch(() => []);
    for (const notification of notifications) {
      const data = notification.data || {};
      if (data.type && data.type !== 'message') continue;
      if (data.type !== 'message' && !data.chatKey && !data.message_id && !data.messageId) continue;
      const owner = Number(data.client_id || data.userId || userId);
      if (owner !== userId) continue;
      const chatKey = data.chatKey || data.chat_key || (data.conference_tag ? `conf:${data.conference_tag}` : '');
      if (count === 0 || read.has(chatKey)) notification.close();
    }
  });
}

self.addEventListener('activate', (event) => {
  // Never navigate open windows from activation. Chromium can keep the second
  // document navigation pending for minutes, leaving a fresh profile or PWA on
  // a permanent white screen. The page-level update guard handles stale entry
  // bundles after the application has booted.
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
  let payload = { title: 'VideoGrace', body: cleanRawPayload, url: '/' };
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

  if (typeof payload.message === 'string' && payload.message.trim()) {
    payload.body = payload.message;
  } else if (typeof payload.preview === 'string' && payload.preview.trim()) {
    payload.body = payload.preview;
  } else if (typeof payload.text === 'string' && payload.text.trim()) {
    payload.body = payload.text;
  }

  if (payload.type === 'message') {
    const author = typeof payload.author === 'string' ? payload.author.trim() : '';
    const authorName = typeof payload.author_name === 'string' ? payload.author_name.trim() : '';
    const senderName = typeof payload.sender_name === 'string' ? payload.sender_name.trim() : '';
    const conference = typeof payload.conference === 'string' ? payload.conference.trim() : '';
    const conferenceName = typeof payload.conference_name === 'string' ? payload.conference_name.trim() : '';
    const name = author || authorName || senderName;
    const room = conference || conferenceName;
    if (name && room) {
      payload.title = `${name} @ ${room}`;
    } else if (name) {
      payload.title = name;
    } else if (room) {
      payload.title = room;
    } else if (!payload.title || payload.title === 'VideoGrace') {
      payload.title = 'Новое сообщение';
    }
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

function resolveNotificationUrl(value) {
  const scopeUrl = new URL(self.registration.scope);

  try {
    const targetUrl = new URL(value || '/', scopeUrl.href);
    if (targetUrl.origin !== scopeUrl.origin || !targetUrl.href.startsWith(scopeUrl.href)) {
      return scopeUrl.href;
    }
    return targetUrl.href;
  } catch {
    return scopeUrl.href;
  }
}

self.addEventListener('push', (event) => {
  const rawPayload = event.data?.text?.() || '';
  const payload = normalizePushPayload(rawPayload);
  const targetUrl = resolveNotificationUrl(payload.url || payload.link || payload.click_action || '/');

  event.waitUntil((async () => {
    // Existing server payloads have no authoritative unread total. Show a flag
    // in the background; the connected app restores the exact chat count.
    if (payload.type === 'message') await updateAppBadge();
    await self.registration.showNotification(payload.title || 'VideoGrace', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: { ...payload, url: targetUrl, swVersion: VG_SW_VERSION },
    });
    if (payload.type === 'message') {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
      for (const client of windows) {
        if (client.visibilityState === 'visible' && client.focused) client.postMessage({ type: 'APP_BADGE_REFRESH' });
      }
    }
  })());
});

async function focusClient(client, targetUrl) {
  if (!client) {
    return null;
  }

  let focusedClient = client;
  if ('navigate' in focusedClient && !focusedClient.url.startsWith(targetUrl)) {
    focusedClient = await focusedClient.navigate(targetUrl).catch(() => null) || focusedClient;
  }

  if ('focus' in focusedClient) {
    return await focusedClient.focus().catch(() => null);
  }

  return null;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = resolveNotificationUrl(
    notificationData.url || notificationData.link || notificationData.click_action || '/'
  );
  const scopeUrl = self.registration.scope;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    const client =
      clientList.find((entry) => entry.url.startsWith(targetUrl)) ||
      clientList.find((entry) => entry.url.startsWith(scopeUrl)) ||
      clientList[0];

    const focused = await focusClient(client, targetUrl);
    if (focused) {
      focused.postMessage({
        type: 'notification_click',
        data: notificationData,
      });
      return;
    }

    try {
      const opened = await clients.openWindow(targetUrl);
      opened?.postMessage?.({
        type: 'notification_click',
        data: notificationData,
      });
      if (!opened && targetUrl !== scopeUrl) {
        await clients.openWindow(scopeUrl);
      }
    } catch {
      if (targetUrl !== scopeUrl) {
        await clients.openWindow(scopeUrl);
      }
    }
  })());
});
