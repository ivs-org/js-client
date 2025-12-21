// src/core/version_watch.js
import { appState, setState } from '../core/app_state.js';
import { CLIENT_VERSION } from './build_info.js';

async function fetchLatestVersion(baseUrl) {
    const url = new URL('version.json', baseUrl);
    url.searchParams.set('_ts', String(Date.now())); // пробиваем кэш
    const r = await fetch(url.toString(), { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok) throw new Error(`version.json http ${r.status}`);
    const j = await r.json();
    return String(j?.version || '').trim();
}

function markUpdateAvailable(latest) {
    const upd = appState.update || {};
    // если версия сменилась на ещё более новую — снова покажем
    const next = {
        ...upd,
        latest,
        available: true,
        dismissed: (upd.latest === latest) ? !!upd.dismissed : false,
    };
    setState({ update: next });
}

export function dismissUpdateBanner() {
    const upd = appState.update || {};
    if (!upd.available) return;
    setState({ update: { ...upd, dismissed: true } });
}

export async function applyUpdateNow() {
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    } catch { }
    window.location.reload();
}

export function startVersionWatch({ baseUrl, intervalMs = 120_000 } = {}) {
    const base = baseUrl || new URL('.', window.location.href).href;
    let timer = 0;
    let inFlight = false;

    async function check() {
        if (inFlight) return;
        inFlight = true;
        try {
            const latest = await fetchLatestVersion(base);
            if (!latest) return;

            // сравниваем latest с версией реально загруженного клиента
            if (latest !== CLIENT_VERSION) {
                markUpdateAvailable(latest);
            }
        } catch {
            // молча: отсутствие version.json не должно ломать продукт
        } finally {
            inFlight = false;
        }
    }

    check();

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
    });

    timer = window.setInterval(() => {
        if (!document.hidden) check();
    }, intervalMs);

    return () => {
        if (timer) clearInterval(timer);
        timer = 0;
    };
}
