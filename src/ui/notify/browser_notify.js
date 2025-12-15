// src/ui/notify/browser_notify.js

export function canNotifyNow() {
    return (
        typeof Notification !== 'undefined' &&
        document.hidden === true &&
        Notification.permission === 'granted'
    );
}

export function showMessageNotification({ title, body, tag, onClick }) {
    if (!canNotifyNow()) return null;

    const n = new Notification(title, {
        body: body || '',
        tag: tag || undefined,  // tag помогает “заменять” уведомление для одного чата
        silent: true,           // звук/рингер у тебя и так свой
    });

    if (typeof onClick === 'function') {
        n.onclick = (ev) => {
            try { ev?.preventDefault?.(); } catch { }
            try { n.close(); } catch { }
            onClick();
        };
    }
    return n;
}
