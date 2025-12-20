/**
 * data/storage.js - High-level Storage: единый источник правды для контактов и конференций
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { buildContactsTree } from '../ui/contacts_tree.js';

let DB_NAME = 'videograce_offline';
let _dbInstance = null;

export function setDbName(name) {
    const n = String(name || '').trim();
    if (!n || n === DB_NAME) return;

    DB_NAME = n;

    // сброс кеша/инстанса
    try { _dbInstance?.close?.(); } catch { }
    _dbInstance = null;
    dbPromise = null;
}

export function getDbName() {
    return DB_NAME;
}

const DB_VERSION = 3;
const STORE_GROUPS = 'groups';
const STORE_MEMBERS = 'contacts';
const STORE_CONFS = 'conferences';
const STORE_SETTINGS = 'settings';

// --- In-memory кэш ---
const groupsById = new Map();
const membersById = new Map();
const confsById = new Map();
const confIdByTag = new Map();
const settingsByKey = new Map();

let contactsMeta = {
    sort_type: 1,       // 1=Name, 2=Number, 0=Undefined
    show_numbers: true,
    conferencesRolled: true,
};

let dbPromise = null;
let initialized = false;

// подписчики на изменения (UI, appState, что угодно)
const listeners = new Set();

async function loadAllFromStore(storeName) {
    const db = await openDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        // современный путь
        if (store.getAll) {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
            return;
        }

        // fallback через курсор, если вдруг getAll нет
        const items = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                items.push(cursor.value);
                cursor.continue();
            } else {
                resolve(items);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

export function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            console.warn('[Storage] IndexedDB not supported');
            resolve(null);
            return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_GROUPS)) {
                db.createObjectStore(STORE_GROUPS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_MEMBERS)) {
                db.createObjectStore(STORE_MEMBERS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_CONFS)) {
                db.createObjectStore(STORE_CONFS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('messages')) {
                db.createObjectStore('messages', { keyPath: 'guid' });
            }
        };

        req.onsuccess = () => {
            _dbInstance = req.result;
            resolve(_dbInstance);
        };
        req.onerror = () => reject(req.error);
    });

    return dbPromise;
}

function withStore(name, mode, fn) {
    return openDb().then(db => {
        if (!db) return null;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(name, mode);
            const store = tx.objectStore(name);
            let res;
            try {
                res = fn(store);
            } catch (e) {
                reject(e);
                return;
            }
            tx.oncomplete = () => resolve(res);
            tx.onerror = () => reject(tx.error);
        });
    });
}

function notify() {
    for (const l of listeners) {
        try { l(); } catch (e) { console.error(e); }
    }
}

// ─────────────────────────────────────
// Публичный API (как класс Storage)
// ─────────────────────────────────────

export const Storage = {
    async init() {
        if (initialized) return;

        await openDb();

        let settings = [];
        let groups = [];
        let members = [];
        let confs = [];

        try {
            [groups, members, confs, settings] = await Promise.all([
                loadAllFromStore(STORE_GROUPS),
                loadAllFromStore(STORE_MEMBERS),
                loadAllFromStore(STORE_CONFS),
                loadAllFromStore(STORE_SETTINGS),
            ]);
        } catch (err) {
            console.warn('[Storage] init load error', err);
            groups = [];
            members = [];
            confs = [];
            settings = [];
        }

        settingsByKey.clear();
        (settings || []).forEach(s => {
            if (!s || typeof s.key === 'undefined') return;
            settingsByKey.set(s.key, s.value);
        });

        groupsById.clear();
        (groups || []).forEach(g => {
            if (!g || typeof g.id === 'undefined') return;
            groupsById.set(g.id, g);
        });

        membersById.clear();
        (members || []).forEach(m => {
            if (!m || typeof m.id === 'undefined') return;
            membersById.set(m.id, m);
        });

        confsById.clear();
        (confs || []).forEach(c => {
            if (!c || typeof c.id === 'undefined') return;
            confsById.set(c.id, c);
        });
        confIdByTag.clear();
        for (const c of confsById.values()) {
            if (c?.tag) confIdByTag.set(c.tag, c.id);
        }

        initialized = true;
        notify();
    },

    // подписка на любые изменения (для UI, appState)
    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // --- Геттеры ---

    getContactsTree() {
        if (!initialized) return [];
        return buildContactsTree({
            groups: Array.from(groupsById.values()),
            members: Array.from(membersById.values()),
            conferences: Array.from(confsById.values()),
            conferencesRolled: !!this.getSetting('ui.conferencesRolled', false),
        });
    },

    getMember(id) {
        return membersById.get(id) || null;
    },

    getConference(id) {
        return confsById.get(id) || null;
    },

    getMeta() {
        return { ...contactsMeta };
    },

    // --- Настройки UI ---

    getSetting(key, defValue = null) {
        return settingsByKey.has(key) ? settingsByKey.get(key) : defValue;
    },

    async setSetting(key, value) {
        settingsByKey.set(key, value);

        await withStore(STORE_SETTINGS, 'readwrite', s => {
            s.put({ key, value });
        });

        notify();
    },

    async toggleSettingBool(key, defValue = false) {
        const cur = !!this.getSetting(key, defValue);
        await this.setSetting(key, !cur);
    },

    // --- Снапшоты с сервера ---

    async applyGroupList(groups) {
        if (!Array.isArray(groups)) groups = [];

        const isRootGroup = (g) => Number(g?.parent_id ?? 0) === 0;

        const prev = new Map(groupsById);

        groupsById.clear();
        for (const g of groups) {
            const old = prev.get(g.id);
            const merged = {
                ...g,
                rolled: old ? !!old.rolled : !isRootGroup(g),
            };
            groupsById.set(merged.id, merged);
        }

        await withStore(STORE_GROUPS, 'readwrite', s => {
            s.clear();
            for (const g of groupsById.values()) s.put(g);
        });

        notify();
    },

    async applyContactList(contactList) {
        const { members, sort_type, show_numbers } = contactList || {};
        const list = Array.isArray(members) ? members : [];

        const prev = new Map(membersById); 

        membersById.clear();
        for (const m of list) {
            const old = prev.get(m.id);
            membersById.set(m.id, {
                ...m,
                unreaded_count: old ? (old.unreaded_count || 0) : (m.unreaded_count || 0),
            });
        }

        contactsMeta = {
            sort_type: typeof sort_type === 'number' ? sort_type : 0,
            show_numbers: !!show_numbers,
        };

        await withStore(STORE_MEMBERS, 'readwrite', s => {
            s.clear();
            for (const m of membersById.values()) s.put(m);
        });

        notify();
    },

    async toggleConferenceRolled(confId) {
        if (!confsById.has(confId)) return;
        const cur = confsById.get(confId);
        const upd = { ...cur, rolled: !cur.rolled };
        confsById.set(confId, upd);

        await withStore(STORE_CONFS, 'readwrite', s => {
            s.put(upd);
        });

        notify();
    },

    async applyConferencesList(conferences) {
        const list = Array.isArray(conferences) ? conferences : [];

        const prev = new Map(confsById);

        confsById.clear();
        for (const c of list) {
            const old = prev.get(c.id);
            const merged = {
                ...c,
                rolled: old ? !!old.rolled : true,
                unreaded_count: old ? (old.unreaded_count || 0) : (c.unreaded_count || 0),
            };
            confsById.set(merged.id, merged);
        }

        confIdByTag.clear();
        for (const c of confsById.values()) {
            if (c?.tag) confIdByTag.set(c.tag, c.id);
        }

        await withStore(STORE_CONFS, 'readwrite', s => {
            s.clear();
            for (const c of confsById.values()) {
                s.put(c);
            }
        });

        notify();
    },

    getMemberById(id) {
        return membersById.get(id) || null;
    },

    getConferenceIdByTag(tag) {
        return confIdByTag.get(tag) || null;
    },

    // --- Точечные обновления ---

    async updateMember(id, patch) {
        if (!membersById.has(id)) return;
        const cur = membersById.get(id);
        const upd = { ...cur, ...patch };
        membersById.set(id, upd);

        await withStore(STORE_MEMBERS, 'readwrite', s => {
            s.put(upd);
        });

        notify();
    },

    async updateConference(id, patch) {
        if (!confsById.has(id)) return;
        const cur = confsById.get(id);
        const upd = { ...cur, ...patch };
        confsById.set(id, upd);

        notify();

        await withStore(STORE_CONFS, 'readwrite', s => {
            s.put(upd);
        });
    },

    async incrementMemberUnread(id, delta = 1) {
        const cur = membersById.get(id);
        if (!cur) return;
        const next = (cur.unreaded_count || 0) + (delta | 0);
        await this.updateMember(id, { unreaded_count: next });
    },

    async incrementConferenceUnread(id, delta = 1) {
        const cur = confsById.get(id);
        if (!cur) return;
        const next = (cur.unreaded_count || 0) + (delta | 0);
        await this.updateConference(id, { unreaded_count: next });
    },

    async toggleGroupRolled(groupId) {
        if (groupId === 'conf-root') {
            await this.toggleSettingBool('ui.conferencesRolled', true);
            return;
        }
        if (!groupsById.has(groupId)) return;
        const cur = groupsById.get(groupId);
        const upd = { ...cur, rolled: !cur.rolled };
        groupsById.set(groupId, upd);

        await withStore(STORE_GROUPS, 'readwrite', s => {
            s.put(upd);
        });

        notify();
    },
};
