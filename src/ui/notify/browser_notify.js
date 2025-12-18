// src/ui/notify/browser_notify.js

export function canNotifyNow() {
    return (
        typeof Notification !== 'undefined' &&
        document.hidden === true &&
        Notification.permission === 'granted'
    );
}
export async function showMessageNotification({ title, body, data }) {
    if (canNotifyNow() && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
            body: body || '',
            silent: true,           // звук/рингер у нас свой
            data
        });
    }
}
