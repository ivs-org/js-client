/**
 * data/member_list.js - Member List (current conference participants)
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

const membersById = new Map();
const listeners = new Set();

function notify() {
    for (const l of listeners) {
        try { l(); } catch (e) { console.error(e); }
    }
}

// Undefined = 0, Online = 1, Offline = 2, Conferencing = 3
const MEMBER_STATE_OFFLINE = 2;

export const MemberList = {
    // Полный ресет
    setSnapshot(members) {
        membersById.clear();
        if (Array.isArray(members)) {
            for (const m of members) {
                if (!m || typeof m.id === 'undefined') continue;
                // Offline/Undefined в снапшоте — не кладём
                if (m.state === MEMBER_STATE_OFFLINE || m.state === 0) {
                    continue;
                }
                membersById.set(m.id, m);
            }
        }
        notify();
    },

    // Инкрементальное обновление по change_member_state
    // payload = [{ id, state, ... }, ...]
    updateStates(members) {
        let changed = false;

        if (!Array.isArray(members)) return;

        for (const m of members) {
            if (!m || typeof m.id === 'undefined') continue;

            const st = m.state;

            if (st === MEMBER_STATE_OFFLINE || st === 0) {
                // удалить из мапы
                if (membersById.delete(m.id)) {
                    changed = true;
                }
            } else {
                // Online / Conferencing — просто кладём/обновляем
                membersById.set(m.id, m);
                changed = true;
            }
        }

        if (changed) {
            notify();
        }
    },

    clear() {
        if (membersById.size === 0) return;
        membersById.clear();
        notify();
    },

    getMembers() {
        return Array.from(membersById.values());
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};
