/**
 * core/app_state.js - Global application state
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

// core/app_state.js
export const appState = {
    view: 'login',             // 'login' | 'register' | 'main'

    layoutMode: 'desktop',     // 'desktop' | 'mobile'

    update: {
        available: false,
        dismissed: false
    },

    auth: {
        server: '',
        login: '',
        password: '',
        autoLogin: false,
        sessionKey: '',
    },

    modal: {
        open: false,
        variant: 'info',       // 'error' | 'success' | 'info' | 'confirm'
        title: '',
        message: '',
        okText: 'OK',
        cancelText: 'Отмена',
        showCancel: false,
        avatarUrl: '',
        avatarLetter: '',
    },

    // Онлайн/оффлайн
    online: false,             // true = есть активный ControlWS
    lastSyncAt: null,          // timestamp последней успешной синхронизации контактов

    user: null,

    // Настройки
    showSettingsPanel: false,
    settingsSection: 'general', // camera | mic | speakers | connection | account | permissions | general | recording
    topMenuOpen: false,
    settingsRevision: 0,

    // Выбор в UI
    activeContactId: null,     // id выбранного Member или Conference
    activeContactType: null,   // 'member' | 'conference' | null
    activeConferenceTag: null, // tag выбраной в списке контактов конференции

    contactsView: 'contacts',  // 'contacts' | 'members'

    contactsRevision: 0,

    chatRevision: 0,
    chatWindow: {},

    activeCall: null,          // { tag, status } | null

    showContactsPanel: true,
    showChatPanel: true,

    camEnabled: false,
    demoEnabled: false,
    micEnabled: false,
};

const listeners = new Set();

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setState(patch) {
    Object.assign(appState, patch);
    for (const l of listeners) l(appState);
}
