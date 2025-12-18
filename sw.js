/**
 * sw.js - Application's Service Worker
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */


self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', function (event) {
    const options = {
        body: event.data.text(),
        icon: '/icon.png',
        badge: '/badge.png'
    };

    event.waitUntil(
        self.registration.showNotification('VideoGrace', options)
    );
});

// Дополнительно можно добавить обработчик клика по уведомлению:
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = new URL('./', self.registration.scope).href; // корень приложения в рамках scope

    event.waitUntil((async () => {
        const clientList = await clients.matchAll({
            type: 'window',
            includeUncontrolled: true, // чтобы найти вкладку даже если она ещё не под контролем SW
        });

        // Есть уже открытая вкладка нашего приложения — фокусируем
        let client = clientList.find(c => c.url.startsWith(targetUrl)) || clientList[0];

        if (client) {
            // Важно: focus есть у WindowClient
            if ('focus' in client) await client.focus();

            // шлём команду в страницу:
            client.postMessage({
                type: 'notification_click',
                data: event.notification.data || null,
            });

            return;
        }

        // Вкладок нет — открываем новую
        await clients.openWindow(targetUrl);
    })());
});
