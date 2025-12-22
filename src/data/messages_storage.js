/**
 * data/messages_storage.js - Хранилище сообщений (чат)
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { openDb } from './storage.js';

const STORE_MESSAGES = 'messages';

const messagesByGuid = new Map();      // guid -> message
const messagesByChatKey = new Map();   // chatKey -> Message[]
const listeners = new Set();

let selfId = null;

// -------- утилиты --------

function notify() {
    for (const l of listeners) {
        try { l(); } catch (e) { console.error(e); }
    }
}

function sortMessages(arr) {
    arr.sort((a, b) => {
        const ad = a.dt || 0;
        const bd = b.dt || 0;
        if (ad !== bd) return ad - bd;
        // чтобы порядок был стабильным
        const ag = String(a.guid || '');
        const bg = String(b.guid || '');
        return ag.localeCompare(bg);
    });
}

function normalizeMessage(msg) {
    if (!selfId) return msg;

    const author = msg.author_id ?? 0;
    const sender = msg.sender_id ?? 0;
    const subscriber = msg.subscriber_id ?? 0;

    // Кейс, о котором ты говоришь:
    // "сообщения 'мне' имеют subscriber_id == author_id"
    // => переписываем subscriber_id на наш selfId.
    if (author !== selfId &&
        subscriber === author &&
        author > 0) {

        return {
            ...msg,
            subscriber_id: selfId
        };
    }

    // Остальное оставляем как есть (исходящие и нормальные входящие)
    return msg;
}

// chatKey:
// - для конфы:  "conf:<conference_tag>"
// - для лички:  "dm:<minId>:<maxId>" (по author/sender/subscriber)
function computeChatKey(msg) {
    // 1) Конференция
    if (msg.conference_tag) {
        return `conf:${msg.conference_tag}`;
    }

    // 2) Личка
    const a = msg.author_id ?? 0;
    const s = msg.sender_id ?? 0;
    const sub = msg.subscriber_id ?? 0;

    if (!selfId) {
        // fallback, если по каким-то причинам selfId ещё не установлен
        const candidate = sub || a || s;
        return candidate ? `dm:${candidate}` : null;
    }

    // Собираем всех, кто не равен нам
    const candidates = [a, s, sub].filter(id => id > 0 && id !== selfId);

    const otherId = candidates[0] || null;
    if (!otherId) return null;

    return `dm:${otherId}`;
}

function computeChatKeyByGuid(guid) {

}

async function loadAllMessagesFromDb() {
    const db = await openDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const store = tx.objectStore(STORE_MESSAGES);

        if (store.getAll) {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
            return;
        }

        const items = [];
        const req = store.openCursor();
        req.onsuccess = (ev) => {
            const cursor = ev.target.result;
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

async function saveMessageToDb(message) {
    const db = await openDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        store.put(message);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function saveMessagesToDbBatch(messages) {
    const db = await openDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);

        for (const m of messages) {
            try { store.put(m); } catch { }
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Проставляет статус прочитано (4) локально + в IndexedDB
 * и возвращает payload для сервера: delivery_messages[{message:{guid,status}}]
 *
 * По умолчанию: отмечаем прочитанным только входящие (не свои).
 */
async function markChatMessagesRead(chatKey, readStatus = 4) {
    if (!chatKey) return null;

    const arr = messagesByChatKey.get(chatKey);
    if (!arr || !arr.length) return null;

    const toSave = [];
    const ack = []; // [{message:{guid,status}}]
    let changed = false;

    for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        if (!m?.guid) continue;

        // read receipts обычно только для входящих
        if (selfId && (m.author_id ?? 0) === selfId) continue;

        const st = Number(m.status ?? 0);
        if (st >= readStatus) continue;

        const upd = { ...m, status: readStatus };
        arr[i] = upd;
        messagesByGuid.set(upd.guid, upd);

        toSave.push(upd);
        ack.push({ guid: upd.guid, status: readStatus });
        changed = true;
    }

    if (!changed) return null;

    try {
        await saveMessagesToDbBatch(toSave);
    } catch (e) {
        console.warn('[MessagesStorage] markChatMessagesRead: batch save failed', e);
    }

    notify();

    return { delivery_messages: ack };
}

export function setSelfId(id) {
    selfId = (typeof id === 'number') ? id : null;
}

export const MessagesStorage = {
    async init() {
        const db = await openDb();
        if (!db) return;

        let stored = [];
        try {
            stored = await loadAllMessagesFromDb();
        } catch (e) {
            console.warn('[MessagesStorage] init load error', e);
            stored = [];
        }

        messagesByGuid.clear();
        messagesByChatKey.clear();

        for (const raw of stored || []) {
            if (!raw || !raw.guid) continue;
            const msg = { ...raw };
            const chatKey = msg.chatKey || computeChatKey(msg);
            if (!chatKey) continue;
            msg.chatKey = chatKey;

            messagesByGuid.set(msg.guid, msg);

            let arr = messagesByChatKey.get(chatKey);
            if (!arr) {
                arr = [];
                messagesByChatKey.set(chatKey, arr);
            }
            arr.push(msg);
        }

        for (const arr of messagesByChatKey.values()) {
            sortMessages(arr);
        }

        notify();
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    getMessagesForChat(chatKey) {
        if (!chatKey) return [];
        const arr = messagesByChatKey.get(chatKey);
        return arr ? [...arr] : [];
    },

    getLastMessageDt() {
        let max = 0;
        for (const msg of messagesByGuid.values()) {
            const dt = msg.dt || 0;
            if (dt > max) max = dt;
        }
        return max; // unixtime или 0
    },

    markChatMessagesRead,

    // messages = массив Message, как прилетает в delivery_messages
    async applyDeliveryMessages(messages) {
        if (!Array.isArray(messages) || !messages.length) return;

        const newlyAdded = [];
        let changed = false;

        for (const src of messages) {
            if (!src || !src.guid) continue;

            const msg = normalizeMessage(src);
            const chatKey = computeChatKey(msg);
            const existing = messagesByGuid.get(msg.guid);

            if (!existing && !chatKey) continue;

            msg.chatKey = chatKey;
                        
            if (existing) {
                if (!msg.chatKey) {
                    msg.chatKey = computeChatKey(existing);
                    if (!msg.chatKey) continue;
                }
                // обновление (например, смена статуса)
                const merged = { ...existing, ...msg };
                messagesByGuid.set(msg.guid, merged);

                const arr = messagesByChatKey.get(msg.chatKey);
                if (arr) {
                    const idx = arr.findIndex(m => m.guid === msg.guid);
                    if (idx >= 0) {
                        arr[idx] = merged;
                    } else {
                        arr.push(merged);
                        sortMessages(arr);
                    }
                } else {
                    messagesByChatKey.set(msg.chatKey, [merged]);
                }
            } else {
                // новый месседж
                newlyAdded.push(msg);
                messagesByGuid.set(msg.guid, msg);
                let arr = messagesByChatKey.get(chatKey);
                if (!arr) {
                    arr = [];
                    messagesByChatKey.set(chatKey, arr);
                }
                arr.push(msg);
                sortMessages(arr);
            }

            try {
                await saveMessageToDb(msg);
            } catch (e) {
                console.warn('[MessagesStorage] save failed', e);
            }

            changed = true;
        }

        if (changed) {
            notify();
        }
        return newlyAdded;
    },
};
