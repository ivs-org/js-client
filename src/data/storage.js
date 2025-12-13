/**
 * data/storage.js - High-level Storage: единый источник правды для контактов и конференций
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { buildContactsTree } from '../ui/contacts_tree.js';

const DB_NAME = 'videograce_offline';
const DB_VERSION = 2;
const STORE_GROUPS = 'groups';
const STORE_MEMBERS = 'contacts';
const STORE_CONFS = 'conferences';

// --- In-memory кэш ---
const groupsById = new Map();
const membersById = new Map();
const confsById = new Map();

let contactsMeta = {
    sort_type: 1,       // 1=Name, 2=Number, 0=Undefined
    show_numbers: true,
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

        req.onsuccess = () => resolve(req.result);
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

        let groups = [];
        let members = [];
        let confs = [];

        try {
            [groups, members, confs] = await Promise.all([
                loadAllFromStore(STORE_GROUPS),
                loadAllFromStore(STORE_MEMBERS),
                loadAllFromStore(STORE_CONFS),
            ]);
        } catch (err) {
            console.warn('[Storage] init load error', err);
            groups = [];
            members = [];
            confs = [];
        }

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

    // --- Снапшоты с сервера ---

    async applyGroupList(groups) {
        if (!Array.isArray(groups)) groups = [];

        const prev = new Map(groupsById);

        groupsById.clear();
        for (const g of groups) {
            const old = prev.get(g.id);
            const merged = {
                ...g,
                rolled: old ? !!old.rolled : !!g.rolled,
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

        membersById.clear();
        for (const m of list) {
            membersById.set(m.id, m);
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
                rolled: old ? !!old.rolled : !!c.rolled,
            };
            confsById.set(merged.id, merged);
        }

        await withStore(STORE_CONFS, 'readwrite', s => {
            s.clear();
            for (const c of confsById.values()) {
                s.put(c);
            }
        });

        notify();
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

    async toggleGroupRolled(groupId) {
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
