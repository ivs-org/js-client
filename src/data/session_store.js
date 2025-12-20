// src/data/session_store.js

const LS_SESSIONS = 'vg_sessions_v2';       // map: sessionKey -> {server, login, pass, lastUsedAt}
const SS_ACTIVE = 'vg_active_session_v2'; // sessionKey (per-tab)

import { closeDb } from './storage.js';

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }
function safeJsonStringify(o) { try { return JSON.stringify(o); } catch { return ''; } }

export function ensureWsUrl(serverInput) {
    let s = String(serverInput || '').trim();
    if (!s) return '';

    // если https/http — превращаем в wss/ws
    if (/^https?:\/\//i.test(s)) {
        return s.replace(/^http/i, 'ws');
    }
    // если уже ws/wss — оставляем
    if (/^wss?:\/\//i.test(s)) {
        return s;
    }

    // иначе считаем что это "host[:port][/path]" без схемы
    const proto = (window.location.protocol === 'https:') ? 'wss://' : 'wss://';
    return proto + s;
}

export function normalizeServer(serverInput) {
    let s = String(serverInput || '').trim();
    if (!s) return '';

    if (/^[a-z]+:\/\//i.test(s)) {
        try {
            const u = new URL(s);
            return (u.host || '').toLowerCase();
        } catch {
            // fallthrough
        }
    }

    s = s.replace(/^[a-z]+:\/\//i, '');
    s = s.split(/[/?#]/)[0];
    return s.toLowerCase();
}

function makeSessionKey(server, login) {
    return `${String(server || '').toLowerCase()}|${String(login || '').toLowerCase()}`;
}

export function deleteIndexedDb(server, login) {
    return new Promise((resolve) => {
        if (!server || !login) return resolve({ ok: false, reason: 'no_db_name' });

        let settled = false;

        const req = indexedDB.deleteDatabase(makeDbName(server, login));

        req.onsuccess = () => {
            if (settled) return;
            settled = true;
            resolve({ ok: true });
        };

        req.onerror = () => {
            if (settled) return;
            settled = true;
            console.warn('[SessionStore] deleteDatabase error', req.error);
            resolve({ ok: false, reason: 'error', error: req.error });
        };

        // если где-то есть открытая вкладка/соединение с этой БД — будет blocked
        req.onblocked = () => {
            if (settled) return;
            settled = true;
            console.warn('[SessionStore] deleteDatabase blocked');
            resolve({ ok: false, reason: 'blocked' });
        };
    });
}

// лёгкий стабильный хэш (FNV-1a) — чтобы имя БД было коротким и без сюрпризов
function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
}

export function makeDbName(server, login) {
    const key = makeSessionKey(server, login);
    const h = fnv1a(key).toString(16);
    return `videograce_offline_${h}`;
}

function loadSessionsMap() {
    const raw = localStorage.getItem(LS_SESSIONS);
    const obj = safeJsonParse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
}

function saveSessionsMap(map) {
    localStorage.setItem(LS_SESSIONS, safeJsonStringify(map));
}

function values(map) {
    return map && typeof map === 'object' ? Object.values(map) : [];
}

export const SessionStore = {
    // --- Active (per-tab) ---
    getActiveKey() {
        try { return sessionStorage.getItem(SS_ACTIVE) || ''; } catch { return ''; }
    },

    setActiveKey(sessionKey) {
        const k = String(sessionKey || '');
        try {
            if (k) sessionStorage.setItem(SS_ACTIVE, k);
            else sessionStorage.removeItem(SS_ACTIVE);
        } catch { /* ignore */ }
    },

    clearActive() {
        this.setActiveKey('');
    },

    getActiveSession() {
        const k = this.getActiveKey();
        return k ? this.getByKey(k) : null;
    },

    // --- Bootstrap ---
    // urlServer = параметр ?server=... (чистый хост или URL)
    // Возвращает:
    // - forceLogin: true если URL server конфликтует с активной вкладкой
    // - session: данные для префилла формы
    // - activeKey: ключ активной сессии вкладки (если есть)
    // - canAutoLogin: можно ли автологиниться (есть activeKey + pass)
    bootstrap({ urlServer = '' } = {}) {
        const map = loadSessionsMap();

        const urlHost = normalizeServer(urlServer);
        const activeKey = this.getActiveKey();
        const active = activeKey ? map[activeKey] : null;

        // Если в URL задан сервер и он НЕ равен активному серверу вкладки — принудительно логин
        if (urlHost && active?.server && normalizeServer(active.server) !== urlHost) {
            return {
                forceLogin: true,
                activeKey: '',
                canAutoLogin: false,
                session: { server: urlHost, login: '', pass: '' }
            };
        }

        // 1) Если есть активная сессия вкладки — она приоритет
        if (active && active.server && active.login) {
            return {
                forceLogin: false,
                activeKey,
                canAutoLogin: !!(active.pass),
                session: {
                    server: normalizeServer(active.server),
                    login: active.login || '',
                    pass: active.pass || ''
                }
            };
        }

        // 2) Если URL server задан — выбираем самый свежий логин на этом сервере
        if (urlHost) {
            let bestKey = '';
            let best = null;

            for (const [k, s] of Object.entries(map)) {
                if (!s) continue;
                if (normalizeServer(s.server) !== urlHost) continue;
                if (!best || (s.lastUsedAt || 0) > (best.lastUsedAt || 0)) {
                    best = s; bestKey = k;
                }
            }

            return {
                forceLogin: false,
                activeKey: '',                 // активную вкладку не выставляем автоматически
                canAutoLogin: false,
                session: best ? {
                    server: urlHost,
                    login: best.login || '',
                    pass: best.pass || ''
                } : {
                    server: urlHost,
                    login: '',
                    pass: ''
                }
            };
        }

        // 3) Иначе — просто самый свежий для префилла (но не автологин)
        let best = null;
        for (const s of values(map)) {
            if (!s?.server || !s?.login) continue;
            if (!best || (s.lastUsedAt || 0) > (best.lastUsedAt || 0)) best = s;
        }

        return {
            forceLogin: false,
            activeKey: '',
            canAutoLogin: false,
            session: best ? {
                server: normalizeServer(best.server),
                login: best.login || '',
                pass: best.pass || ''
            } : {
                server: '',
                login: '',
                pass: ''
            }
        };
    },

    // --- Registry (localStorage) ---
    upsert({ server, login, password }) {
        const srv = normalizeServer(server);
        const lg = String(login || '').trim();
        if (!srv || !lg) return '';

        const key = makeSessionKey(srv, lg);
        const map = loadSessionsMap();

        map[key] = {
            server: srv,
            login: lg,
            pass: password || '',
            lastUsedAt: Date.now(),
        };

        saveSessionsMap(map);
        return key;
    },

    touch(sessionKey) {
        const key = String(sessionKey || '');
        if (!key) return;
        const map = loadSessionsMap();
        const s = map[key];
        if (!s) return;
        map[key] = { ...s, lastUsedAt: Date.now() };
        saveSessionsMap(map);
    },

    listSessions() {
        const map = loadSessionsMap();
        const out = [];

        for (const [key, s] of Object.entries(map)) {
            if (!s) continue;
            const server = normalizeServer(s.server || '');
            const login = String(s.login || '').trim();
            if (!server || !login) continue;

            out.push({
                key,
                server,
                login,
                pass: s.pass || '',
                lastUsedAt: s.lastUsedAt || 0,
            });
        }

        out.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
        return out;
    },

    getByKey(sessionKey) {
        const key = String(sessionKey || '');
        if (!key) return null;

        const map = loadSessionsMap();
        const s = map[key];
        if (!s) return null;

        return {
            key,
            server: normalizeServer(s.server || ''),
            login: s.login || '',
            pass: s.pass || '',
            lastUsedAt: s.lastUsedAt || 0,
        };
    },

    remove(sessionKey) {
        const key = String(sessionKey || '');
        if (!key) return false;

        const map = loadSessionsMap();
        if (!map[key]) return false;

        delete map[key];
        saveSessionsMap(map);

        // если удалили активную сессию вкладки — очистим её
        if (this.getActiveKey() === key) this.clearActive();

        return true;
    },

    // 'последний вход' для UI — вычислим без LS_LAST
    getMostRecentKey() {
        const sessions = this.listSessions();
        return sessions[0]?.key || '';
    },

    // Полная очистка при удалении логина
    async removeWithDb(sessionKey) {
        const key = String(sessionKey || '');
        if (!key) return { removed: false, db: { ok: false, reason: 'no_key' } };

        const s = this.getByKey(key);
        if (!s) return { removed: false, db: { ok: false, reason: 'no_session' } };

        const removed = this.remove(key);

        try { closeDb; } catch {}

        const db = await deleteIndexedDb(s.server, s.login);

        return { removed, db };
    },

    // Возвращает true только если есть сохранённая сессия и пароль совпал
    verifyOfflinePassword({ server, login, password }) {
        const srv = normalizeServer(server);
        const lg = String(login || '').trim().toLowerCase();
        const pw = String(password || '');

        if (!srv || !lg) return false;

        const map = loadSessionsMap();
        const key = makeSessionKey(srv, lg);
        const s = map[key];

        if (!s) return false;

        const saved = String(s.pass || '');
        // если сохранённого пароля нет — оффлайн логин запрещаем
        if (!saved) return false;

        return saved === pw;
    },

};
