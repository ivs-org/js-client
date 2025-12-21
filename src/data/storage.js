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
const contactsById = new Map();
const confsById = new Map();
const confIdByTag = new Map();
const settingsByKey = new Map();

let contactsMeta = {
    sort_type: 1,       // 1=Name, 2=Number, 0=Undefined
    show_numbers: false,
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
            console.log(`💾 Storage opened db ${DB_NAME} ver: ${DB_VERSION}`);
        };
        req.onerror = () => reject(req.error);
    });

    return dbPromise;
}

export function closeDb() {
    try {
        dbPromise?.close();
        console.log(`💾 Storage closed db ${DB_NAME} ver: ${DB_VERSION}`);
    } catch { }
    dbPromise = null;
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
            console.log('💾 Storage init and loaded');
        } catch (err) {
            console.warn('💾 Storage init load error', err);
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

        contactsById.clear();
        (members || []).forEach(m => {
            if (!m || typeof m.id === 'undefined') return;
            contactsById.set(m.id, m);
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
            members: Array.from(contactsById.values()),
            conferences: Array.from(confsById.values()),
            conferencesRolled: !!this.getSetting('ui.conferencesRolled', false),
        });
    },

    getMember(id) {
        return contactsById.get(id) || null;
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
        const { members, sort_type, show_numbers, full } = contactList || {};
        const list = Array.isArray(members) ? members : [];

        // Когда сервер начнёт явно слать "полный снапшот" — можно включить.
        // Сейчас — частичные апдейты, поэтому full обычно false/undefined.
        const isFull = !!full;

        // мета (обновляем только если поле реально пришло)
        let metaChanged = false;
        if (typeof sort_type === 'number' && sort_type !== contactsMeta.sort_type) {
            contactsMeta.sort_type = sort_type;
            metaChanged = true;
        }
        if (typeof show_numbers === 'number' && !!show_numbers !== contactsMeta.show_numbers) {
            contactsMeta.show_numbers = !!show_numbers;
            metaChanged = true;
        }
        if (typeof show_numbers === 'undefined' && !!contactsMeta.show_numbers) {
            contactsMeta.show_numbers = false;
            metaChanged = true;
        }

        // операции для IndexedDB
        const puts = [];
        const dels = [];

        let changed = metaChanged;

        // Для режима full: будем знать кто "должен" остаться
        const seen = isFull ? new Set() : null;

        // helper: стоит ли писать put в IDB (дешёвая проверка только по ключам патча)
        const hasPatchChange = (oldObj, patchObj) => {
            if (!oldObj) return true;
            for (const k of Object.keys(patchObj)) {
                // если поле реально отличается — пишем
                if (oldObj[k] !== patchObj[k]) return true;
            }
            return false;
        };

        for (const src of list) {
            if (!src || typeof src.id === 'undefined') continue;

            const id = src.id;

            // deleted апдейт
            if (src.deleted) {
                if (contactsById.has(id)) {
                    contactsById.delete(id);
                    changed = true;
                }
                dels.push(id);
                continue;
            }

            if (isFull) seen.add(id);

            const old = contactsById.get(id) || null;

            // В full-режиме считаем, что сервер прислал "полную" карточку контакта,
            // но локальные счетчики (unreaded_count) всё равно бережём.
            // В patch-режиме — обычный merge.
            const merged = isFull
                ? { ...src }
                : { ...(old || {}), ...src };

            // Preserve local unread if server не прислал (обычный кейс)
            if (old && typeof src.unreaded_count === 'undefined') {
                merged.unreaded_count = old.unreaded_count || 0;
            } else if (!old) {
                merged.unreaded_count = merged.unreaded_count || 0;
            }

            // Обновим кэш
            contactsById.set(id, merged);

            // Решаем: писать ли в IndexedDB
            // (в patch-режиме: только если реально что-то изменилось в полях патча;
            //  в full-режиме: пишем всегда, т.к. это "истина" с сервера)
            const needWrite = isFull ? true : hasPatchChange(old, src);
            if (needWrite) puts.push(merged);

            // Для notify/UI
            if (!old) changed = true;
            else if (!changed && needWrite) changed = true;
        }

        // В режиме full: удалим тех, кто "пропал" из снапшота
        if (isFull && seen) {
            for (const id of Array.from(contactsById.keys())) {
                if (!seen.has(id)) {
                    contactsById.delete(id);
                    dels.push(id);
                    changed = true;
                }
            }
        }

        // Ничего не изменилось — ничего не пишем и не дергаем UI
        if (!changed && puts.length === 0 && dels.length === 0) return;

        // Пишем точечно: delete + put, без store.clear()
        await withStore(STORE_MEMBERS, 'readwrite', (s) => {
            for (const id of dels) s.delete(id);
            for (const m of puts) s.put(m);
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
        return contactsById.get(id) || null;
    },

    getConferenceIdByTag(tag) {
        return confIdByTag.get(tag) || null;
    },

    // --- Точечные обновления ---

    async updateMember(id, patch) {
        if (!contactsById.has(id)) return;
        const cur = contactsById.get(id);
        const upd = { ...cur, ...patch };
        contactsById.set(id, upd);

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
        const cur = contactsById.get(id);
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
