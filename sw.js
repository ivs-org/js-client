self.addEventListener('push', function (event) {
    const options = {
        body: event.data.text(),
        icon: '/icon.png',
        badge: '/badge.png'
    };

    event.waitUntil(
        self.registration.showNotification('Новое сообщение в SPA', options)
    );
});

// Дополнительно можно добавить обработчик клика по уведомлению:
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    // Открыть окно приложения при клике
    event.waitUntil(clients.openWindow('/'));
});
