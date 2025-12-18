# State & Reactivity

## appState responsibilities
- UI navigation state (current panel, selected chat, view mode)
- transient UI flags (modals open, settings section)
- call/session state pointers (active conf, active call, etc.)
- MUST NOT own media resources directly (ws/track/decoder live in services)

## State shape (example)
```js
appState = {
    view: 'login',             // 'login' | 'register' | 'main'

    layoutMode: 'desktop',     // 'desktop' | 'mobile'

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
```

## setState contract

 - setState merges partial updates (document actual semantics)
 - triggers subscribers
 - subscribers call renderLayout(state)

## Subscribe contract

 - UI subscribes once at bootstrap
 - no per-component subscriptions unless necessary

## UI rules

 - render functions are pure w.r.t side-effects:
 - OK: DOM creation/updates, event binding
 - NOT OK: ws.connect, getUserMedia, db.open, await

## Side-effects

### Side-effects live in controllers/services:
 
 - ControlWS
 - MediaChannel
 - Storage init/load
 - Call orchestration in app.js

## Testing checklist

 - State updates don’t cause duplicated starts
 - F5 restores stable UI defaults (rolled groups, etc.)
 - Notification/presence updates reflect immediately without reload
