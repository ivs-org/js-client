/**
 * app.js - The VideoGrace Web Client Application
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

"use strict";

import { UrlBoot } from './core/url_boot.js';
import { startVersionWatch } from './core/version_watch.js';
import { SessionStore, makeDbName, normalizeServer } from './data/session_store.js';
import { Storage, closeDb, setDbName } from './data/storage.js';
import { setState, appState } from './core/app_state.js';
import { MemberList } from './data/member_list.js';
import { MessagesStorage, setSelfId as messagesSetSelfId } from './data/messages_storage.js';
import { initLayout } from './ui/layout.js';
import { registerUserViaHttp, interpretRegistrationResult } from './transport/registration_http.js';
import { showOk, showError, confirmDialog, _resolveModal } from './ui/modal.js';
import { ControlWS } from './transport/control_ws.js';
import { MediaChannel } from './media/media_channel.js';
import { AudioShared } from './media/audio/audio_shared.js';
import { MicSession } from './media/audio/mic_session.js';
import { CameraSession } from './media/video/cam_session.js';
import { ScreenSession } from './media/video/screen_session.js';
import { getResolution } from './media/video/resolution.js';
import { Ringer } from './ui/ringer/ringer.js';
import { RingType } from './ui/ringer/ring_type.js';
import { showMessageNotification } from './ui/notify/browser_notify.js';
import { parsePayload } from './ui/panels/chat_panel.js';
import { ScreenWakeLock } from './ui/screen_wake_lock.js';

// ─────────────────────────────────────
// Static
// ─────────────────────────────────────

const MOBILE_BREAKPOINT = 900;

let mic = null;
let cam = null;
let scr = null;

let lastCamId = 0;
let lastMicId = 0;
let lastSpkId = 0;

const urlParams = new URLSearchParams(location.search);
window.confTag = urlParams.get('conf') || 'show';

function log(s) {
    const t = new Date().toISOString().slice(11, 23);
    console.debug(s);
}

function randomTag(len = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

let ctrl = null;
let ctrlEventUnsubscribers = [];

const mediaSessions = new Map();

export const ringer = new Ringer({ baseUrl: '/assets/sounds', volume: 0.9 });

const CALL_REQUEST_TYPE = Object.freeze({
    Undefined: 0,
    Invocation: 1,
    Cancel: 2,
});

const CALL_RESPONSE_TYPE = Object.freeze({
    Undefined: 0,
    AutoCall: 1,
    NotConnected: 2,
    Accept: 3,
    Refuse: 4,
    Busy: 5,
    Timeout: 6,
});

const SEND_CONNECT_FLAGS = Object.freeze({
    InviteCall: 0,
    AddMember: 1,
});

let incomingCallToken = 0;
let pendingInvite = null;

// ─────────────────────────────────────
// Точка входа
// ─────────────────────────────────────

/**
 * Проверка на встроенные браузеры (Telegram, WhatsApp, etc.)
 */
function isEmbeddedBrowser() {
    const ua = navigator.userAgent || '';
    
    // Telegram Webview
    if (/Telegram/i.test(ua)) {
        return { name: 'Telegram', detected: true };
    }
    
    // WhatsApp
    if (/WhatsApp/i.test(ua)) {
        return { name: 'WhatsApp', detected: true };
    }
    
    // Facebook Messenger
    if (/FBAN|FBAV/i.test(ua)) {
        return { name: 'Facebook Messenger', detected: true };
    }
    
    // Instagram
    if (/Instagram/i.test(ua)) {
        return { name: 'Instagram', detected: true };
    }
    
    // VK App
    if (/VKApp|VKMobile/i.test(ua)) {
        return { name: 'VK App', detected: true };
    }
    
    // Line
    if (/Line/i.test(ua)) {
        return { name: 'Line', detected: true };
    }
    
    // WeChat
    if (/MicroMessenger|WeChat/i.test(ua)) {
        return { name: 'WeChat', detected: true };
    }
    
    return { detected: false };
}

/**
 * Попытка открыть в системном браузере
 */
function openInSystemBrowser() {
    const url = window.location.href;
    
    // Пробуем разные схемы для открытия в браузере
    const schemes = [
        `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`,
        `googlechrome://${url.replace(/^https?:\/\//, '')}`,
        `chrome://${url}`,
        `firefox://${url}`,
        `opera://${url}`,
    ];
    
    // Пробуем открыть через intent (Android)
    for (const scheme of schemes) {
        try {
            window.location.href = scheme;
        } catch { }
    }
    
    // Показываем инструкцию
    showEmbeddedBrowserWarning(url);
}

/**
 * Показываем предупреждение о встроенном браузере
 */
function showEmbeddedBrowserWarning(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    overlay.innerHTML = `
        <div style="
            background: #1a1a1a;
            border-radius: 16px;
            padding: 30px;
            max-width: 400px;
            text-align: center;
            color: white;
        ">
            <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
            <h2 style="margin: 0 0 15px 0; font-size: 22px;">Откройте в браузере</h2>
            <p style="margin: 0 0 20px 0; color: #aaa; line-height: 1.5;">
                Этот сайт не работает во встроенном браузере.<br><br>
                <strong>Нажмите на меню (⋮ или ⋯) и выберите<br>«Открыть в браузере»</strong>
            </p>
            <div style="
                background: #2a2a2a;
                border-radius: 8px;
                padding: 12px;
                margin: 20px 0;
                font-size: 12px;
                color: #888;
                word-break: break-all;
            ">${url}</div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: #4a9eff;
                color: white;
                border: none;
                padding: 14px 28px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 10px;
            ">Понятно</button>
            <div style="margin-top: 20px; font-size: 13px; color: #666;">
                <strong>Android:</strong> Меню → Открыть в Chrome<br>
                <strong>iOS:</strong> Меню → Открыть в Safari
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', async () => {
    const boot = bootstrap();

    // Проверка на встроенные браузеры (Telegram, WhatsApp, etc.)
    const embedded = isEmbeddedBrowser();
    if (embedded.detected) {
        console.warn(`⚠️ Обнаружен встроенный браузер: ${embedded.name}`);
        // Показываем предупреждение, но не блокируем работу
        openInSystemBrowser();
    }

    // Firefox ESR: проверка MediaStreamTrackProcessor для информирования о режиме работы
    if (!('MediaStreamTrackProcessor' in window)) {
        console.info('ℹ️ MediaStreamTrackProcessor недоступен, используется совместимый режим (canvas + AudioWorklet)');
        console.info('   Это может повлиять на производительность кодирования видео.');
    }

    // UI
    startVersionChecker();
    initResponsiveLayout();
    initLayout();
    initButtonsPanelActions();
    await initAuthEvents();

    // Workers
    await initAudio();
    await initSW();

    // Go!
    await tryLogin(boot);
});

function bootstrap() {
    UrlBoot.stashFromUrlAndCleanUrl();
    const boot = SessionStore.bootstrap({ urlServer: UrlBoot.getBootServer() });

    setState({
        auth: {
            server: boot.session.server || '',
            login: boot.session.login || '',
            password: '',
        },
        view: 'login'
    });

    return boot;
}

async function tryLogin(boot) {    
    if (boot.canAutoLogin) {
        await startLogin(boot.session.server, boot.session.login, boot.session.pass);
    }
}

// ─────────────────────────────────────
// Хранилище
// ─────────────────────────────────────

async function sendReaded() {
    if (appState.activeContactType === 'member') {
        const chatKey = appState.activeContactId ? `dm:${appState.activeContactId}` : '';
        const payload = await MessagesStorage.markChatMessagesRead(chatKey);

        if (payload && ctrl) {
            ctrl._send(payload);
        }
    }
}

async function initDataLayer(server, login) {
    setDbName(makeDbName(server, login));

    await Storage.init();

    Storage.subscribe(async () => {
        setState({
            contactsRevision: (appState.contactsRevision || 0) + 1,
        });

        sendReaded();

        const camId = Storage.getSetting('media.cameraDeviceId', '');
        const micId = Storage.getSetting('media.micDeviceId', '');
        const spkId = Storage.getSetting('media.speakerDeviceId', '');

        if (spkId !== lastSpkId) {
            lastSpkId = spkId;
            AudioShared.setOutputDevice?.(spkId); // применить сразу
        }

        if (camId !== lastCamId) {
            lastCamId = camId;
            if (cam && appState.camEnabled) cam.restartCapture?.(); // применить сразу, если камера уже включена
        }

        if (micId !== lastMicId) {
            lastMicId = micId;
            if (mic && appState.micEnabled) mic.restartCapture?.();
        }
    });

    MemberList.subscribe(() => {
        setState({
            contactsRevision: (appState.contactsRevision || 0) + 1,
        });
    });

    await MessagesStorage.init();

    MessagesStorage.subscribe(() => {
        setState({
            chatRevision: (appState.chatRevision || 0) + 1,
        });
    });
}

// ─────────────────────────────────────
// Version checker
// ─────────────────────────────────────
function startVersionChecker() {
    const baseUrl = new URL('.', window.location.href).href;
    startVersionWatch({ baseUrl, intervalMs: 2 * 60 * 1000 });
}

// ─────────────────────────────────────
// Аудио
// ─────────────────────────────────────

async function initAudio() {
    const audioCtx = AudioShared.ensureContext();
    await AudioShared.ensureWorklet();

    AudioShared.setOutputDevice?.(Storage.getSetting('media.speakerDeviceId', ''));

    console.log('🎧 Initializing audio playback...');

    // Для AEC AudioContext должен быть активирован пользователем
    document.body.addEventListener('click', async () => {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
            console.log('🎧 AudioContext resumed');
        }
    }, { once: true });
}

// ─────────────────────────────────────
// Web push
// ─────────────────────────────────────

async function initSW() {
    if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(() => console.log('👷 Service Worker зарегистрирован'))
            .catch(err => console.error('👷 Ошибка регистрации Service Worker:', err));

        await navigator.serviceWorker.addEventListener('message', (ev) => {
            const msg = ev.data;
            if (msg?.type !== 'notification_click') return;

            const d = msg.data;

            if (d.contact_type == 'member') {
                Storage.updateMember(d.contact_id, { unreaded_count: 0 }).catch(() => { });
            }
            else if (d.contact_type == 'conference') {
                Storage.updateConference(Storage.getConferenceIdByTag(d.conference_tag),
                    { unreaded_count: 0 }).catch(() => { });
            }
                       
            setState({
                activeContactType: d.contact_type,
                activeContactId: d.contact_id,
                activeConferenceTag: d.conference_tag
            });
        });
    }
}
function sendSubscriptionToBackend(sub) {
    // TODO: сюда нужен реальный запрос на бэк
    console.log('sendSubscriptionToBackend stub:', sub);
}

function subscribeUserToPush() {
    navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
            if (subscription) {
                console.log('🛠️ Пользователь уже подписан. Объект подписки:', subscription);
            } else {
                console.log('🛠️ Пользователь еще не подписан. Запуск подписки...');

                const applicationServerKey = 'BNOLt7sJq9bx0bv2eXhcQMykHzA7_uSqpDCQREKxe-P0LRy4qQeN9eP11QZVLna916kcl116uQZzrMT2ABuTXbg';

                registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                })
                    .then(newSubscription => {
                        console.log('🛠️ Пользователь успешно подписан:', newSubscription);
                        sendSubscriptionToBackend(newSubscription);
                    })
                    .catch(err => {
                        console.error('🛠️ Не удалось подписаться на уведомления:', err);
                    });
            }
        });
    });
}

// ─────────────────────────────────────
// Mobile helpers
// ─────────────────────────────────────

function detectLayoutMode() {
    if (typeof window === 'undefined') return 'desktop';
    return window.innerWidth <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

function initResponsiveLayout() {
    // Первый запуск
    const mode = detectLayoutMode();
    setState({ layoutMode: mode });

    // Ресайз
    window.addEventListener('resize', () => {
        const newMode = detectLayoutMode();
        if (newMode !== appState.layoutMode) {
            setState({ layoutMode: newMode });

            console.log('🛠️ changed mode to: ', newMode);

            if (newMode === 'desktop') {
                setState({
                    showContactsPanel: true,
                    showChatPanel: true,
                });
            }
            else if (newMode === 'mobile') {
                setState({
                    showContactsPanel: !appState.activeCall,
                    showChatPanel: false,
                });
            }
        }
    });

    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            await sendReaded();
        }
    });
}

/* ------------------------------------------------------------------
 * Основные кнопки UI
 * ------------------------------------------------------------------ */

function connectToConference() {
    checkWebCodecs();

    const { activeContactType, activeContactId, activeConferenceTag } = appState;
    if (activeContactType !== 'conference' || !activeContactId) {
        // ничего не выбрано
        return;
    }

    const conf = Storage.getConference(activeContactId);
    if (!conf) return;

    const tag = conf.tag || activeConferenceTag;
    connectToConferenceByTag(tag, { type: 'conference', name: conf.name || tag });
}

function connectToConferenceByTag(tag, opts = {}) {
    if (!ctrl || !tag) return;

    // Firefox ESR: закрываем Settings Panel для освобождения треков камеры/микрофона
    setState({ showSettingsPanel: false });

    checkWebCodecs();
    AudioShared.kickFromGesture();
    ScreenWakeLock.enable();

    if (opts.type === 'p2p') {
        setState({
            activeCall: {
                ...(appState.activeCall || {}),
                type: 'p2p',
                status: 'connecting',
                tag
            }
        });
    }

    ctrl.sendConnectToConference(tag);
}

function getCallTargetName(member) {
    return member?.number || member?.name || member?.login || (member?.id ? String(member.id) : '');
}

function startOutgoingCall() {
    if (!ctrl) return;

    const { activeContactType, activeContactId } = appState;
    if (activeContactType !== 'member' || !activeContactId) return;

    const member = Storage.getMember(activeContactId);
    if (!member) return;

    const targetName = getCallTargetName(member);
    if (!targetName) return;

    setState({
        activeCall: {
            type: 'p2p',
            status: 'dialing',
            direction: 'outgoing',
            peerId: member.id,
            peerName: member.name || member.login || targetName,
            callName: targetName,
        }
    });

    ringer.Ring(RingType.CallOut);
    ctrl.sendCallRequest({
        name: targetName,
        id: member.id || 0,
        connection_id: 0,
        type: CALL_REQUEST_TYPE.Invocation
    });
}

function endP2PCall(reason = '') {
    if (!ctrl) return;

    const call = appState.activeCall;
    if (!call || call.type !== 'p2p') return;

    if (call.status === 'connected' || ctrl.getCurrentConference()) {
        disconnectFromConference();
        return;
    }

    if (call.direction === 'outgoing' && call.callName) {
        ctrl.sendCallRequest({
            name: call.callName,
            id: call.peerId || 0,
            connection_id: call.peerConnectionId || 0,
            type: CALL_REQUEST_TYPE.Cancel
        });
    } else if (call.direction === 'incoming' && call.peerId && call.peerConnectionId) {
        ctrl.sendCallResponse({
            id: call.peerId,
            connection_id: call.peerConnectionId,
            type: CALL_RESPONSE_TYPE.Refuse,
            name: call.callName || '',
        });
    }

    if (ringer.Started()) ringer.Stop();
    if (reason) ringer.Ring(RingType.Hangup);

    setState({ activeCall: null });
}

function initButtonsPanelActions() {
    // Делегирование: ловим клики по кнопкам панели управления по id
    document.addEventListener('click', (event) => {
        const el = event.target;
        if (!(el instanceof HTMLElement)) return;

        const btn = el.closest('button');
        if (!btn) return;

        switch (btn.id) {
            case 'btnCancelOutgoingCall':
                if (!ctrl || !appState.online) return;
                endP2PCall('manual');
                break;
            case 'btnToggleCall':
                if (!ctrl || !appState.online) return;
                if (appState.activeContactType === 'conference') {
                    if (!ctrl.getCurrentConference()) {
                        connectToConference();
                    } else {
                        // Отключиться
                        disconnectFromConference();
                    }
                } else if (appState.activeContactType === 'member') {
                    if (appState.activeCall?.type === 'p2p') {
                        endP2PCall('manual');
                    } else {
                        startOutgoingCall();
                    }
                }
                break;

            case 'btnToggleCam':
                if (!ctrl || !ctrl.getCurrentConference()) return;
                if (cam) {
                    stopCam();
                } else {
                    startCam();
                }
                break;
            case 'btnToggleDemo':
                if (!ctrl || !ctrl.getCurrentConference()) return;
                if (scr) {
                    stopScreenShare();
                } else {
                    startScreenShare();
                }
                break;
                break;
            case 'btnToggleMic':
                if (!ctrl || !ctrl.getCurrentConference()) return;
                if (mic) {
                    stopMic();
                } else {
                    startMic();
                }
                break;

            case 'btnLogout':
                logout();
        }
    });
}

function logout() {
    disconnectFromConference();
    try { ctrl?.disconnect?.(1000, 'logout'); } catch { }
    try { ctrl = null; window.ctrl = null; } catch { }
    for (const m of mediaSessions.values()) m.close();
    mediaSessions.clear();

    SessionStore.clearActive();

    closeDb();

    setState({ topMenuOpen: false, view: 'login' });
}

/* ------------------------------------------------------------------
 * Регистрация
 * ------------------------------------------------------------------ */

async function initAuthEvents() {
    // Логин
    document.addEventListener('app:login', async (e) => {
        const { server, login, password } = e.detail || {};

        await startLogin(server, login, password);
    });

    // Ошибки валидации формы регистрации (пароли не совпадают и т.п.)
    document.addEventListener('app:register-error', (e) => {
        const msg = e.detail && e.detail.message;
        if (msg) {
            showError(msg);
        }
    });

    // Непосредственно попытка регистрации
    document.addEventListener('app:register', async (e) => {
        const { server, login, name, password } = e.detail || {};

        try {
            const httpResult = await registerUserViaHttp({
                server,
                login,
                password,
                name,
                captcha: '', // капча пока задизейблена
            });

            const info = interpretRegistrationResult(httpResult);

            if (!info.ok) {
                showError(info.message);
                return;
            }

            showOk(
                'Подтверждение',
                'Регистрация выполнена успешно!'
            );

            // Логинимся
            const payload = {
                server: server || '',
                login: login || '',
                password: password || ''
            };

            document.dispatchEvent(new CustomEvent('app:login', {
                detail: payload
            }));
        } catch (err) {
            console.error('👷 registration error', err);
            showError('Ошибка регистрации: ' + (err.message || 'неизвестная ошибка'));
        }
    });
}

/* ------------------------------------------------------------------
 * WebCodecs проверка
 * ------------------------------------------------------------------ */

function checkWebCodecs() {
    const hasVideoDecoder = 'VideoDecoder' in window;
    const hasAudioDecoder = 'AudioDecoder' in window;
    const hasVideoEncoder = 'VideoEncoder' in window;
    const hasAudioEncoder = 'AudioEncoder' in window;
    
    console.log('🔍 WebCodecs проверка:', {
        VideoDecoder: hasVideoDecoder,
        AudioDecoder: hasAudioDecoder,
        VideoEncoder: hasVideoEncoder,
        AudioEncoder: hasAudioEncoder,
        SecureContext: window.isSecureContext,
        Protocol: location.protocol,
        Hostname: location.hostname,
        UserAgent: navigator.userAgent
    });

    if (!hasVideoDecoder || !hasAudioDecoder) {
        const msg = 'WebCodecs недоступен в этом браузере.\n\n' +
                    'Возможные причины:\n' +
                    '• Требуется HTTPS (не http://)\n' +
                    '• Браузер не поддерживает WebCodecs\n' +
                    '• Устаревшая версия браузера\n\n' +
                    'Попробуйте:\n' +
                    '1. Открыть через HTTPS\n' +
                    '2. Обновить браузер\n' +
                    '3. Использовать Chrome/Edge';
        showError(msg);
        console.error('❌ WebCodecs недоступен:', { hasVideoDecoder, hasAudioDecoder });
        return false;
    }
    
    // Firefox ESR: MediaStreamTrackProcessor может быть недоступен — используем canvas/audio worklet
    if (!('MediaStreamTrackProcessor' in window)) {
        console.warn('⚠️ MediaStreamTrackProcessor недоступен, используется совместимый режим (canvas + AudioWorklet)');
        // Не показываем ошибку — теперь это работает через альтернативный API
    }
    
    const sabAvailable = typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated;

    if (!sabAvailable) {
        console.warn('⚠️ SharedArrayBuffer недоступен (требуется для оптимальной работы)');
        // Не блокируем работу, просто предупреждаем
    }
    return true;
}

/* ------------------------------------------------------------------
 * Логин / запуск ControlWS
 * ------------------------------------------------------------------ */

function wireControlEvents() {
    if (!ctrl) return;

    // снять старые подписки, если перезапустили логин
    ctrlEventUnsubscribers.forEach(unsub => {
        try { unsub(); } catch { }
    });
    ctrlEventUnsubscribers = [];

    ctrlEventUnsubscribers.push(
        ctrl.bus.on('auth', handleControlAuth),
        ctrl.bus.on('connectToConferenceResponse', handleConnectToConferenceResponse),
        ctrl.bus.on('disconnectFromConference', handleDisconnectFromConference),
        ctrl.bus.on('ping', () => { }),
        ctrl.bus.on('callRequest', handleCallRequest),
        ctrl.bus.on('callResponse', handleCallResponse),
        ctrl.bus.on('conferenceCreated', handleConferenceCreated),
        ctrl.bus.on('startConnectToConference', handleStartConnectToConference),
        ctrl.bus.on('deviceConnected', handleDeviceConnected),
        ctrl.bus.on('deviceDisconnect', handleDeviceDisconnect),
        ctrl.bus.on('deviceParams', handleDeviceParams),
        ctrl.bus.on('new_message', handleNewMessage),
        ctrl.bus.on('error', handleControlError),
        ctrl.bus.on('close', handleControlClose),
    );
}

function handleControlAuth(token) {
    log('🛠️ Auth on server OK, token received');

    const key = SessionStore.upsert({
        server: ctrl.server,
        login: ctrl.login,
        password: ctrl.password
    });
    SessionStore.setActiveKey(key);

    UrlBoot.clearBootServer();

    setState({
        view: 'main',
        online: true,
        user: {
            id: ctrl.client_id,
            displayName: ctrl.login || 'Пользователь',
            login: ctrl.login || '',
            server: ctrl.server || '',
        }
    });

    messagesSetSelfId(ctrl.client_id);

    ctrl.loadMessages();

    subscribeUserToPush();

    /// URL work
    // Adding to conferences
    const confs = UrlBoot.getBootRegConferences();
    if (confs) {
        UrlBoot.clearBootRegConferences();
        for (const c of confs) {
            ctrl.addMeToConference(c);
        }
    }

    // Adding to groups
    const groups = UrlBoot.getBootRegGroups();
    if (groups) {
        UrlBoot.clearBootRegGroups();
        for (const g of groups) {
            ctrl.addMeToGroup(g);
        }
    }

    // Join to conference
    const bootConf = UrlBoot.getBootConference();
    if (bootConf != '') {
        UrlBoot.clearBootConference();
        ctrl.addMeToConference(bootConf);
        ctrl.sendConnectToConference(bootConf);
    }
}

function handleConnectToConferenceResponse(resp) {
    if (resp.result != 1) {
        switch (resp.result) {
            case 2: showError('Конференция не существует'); break;
            case 3: showError('У вас нет доступа к этой конференции'); break;
            default: showError('Ошибка подключения к конференции'); break;
        }
        return;
    }

    log('🛠️ connected_to_conference: ' + resp.name);

    const isMobile = appState.layoutMode === 'mobile';
    
    const existingCall = appState.activeCall;
    const nextCall = {
        type: existingCall?.type || 'conference',
        tag: resp.tag,
        name: resp.name,
        status: 'connected',
        direction: existingCall?.direction,
        peerId: existingCall?.peerId,
        peerName: existingCall?.peerName,
        peerConnectionId: existingCall?.peerConnectionId,
        callName: existingCall?.callName,
    };

    setState({
        contactsView: 'members',
        activeCall: nextCall,
        showContactsPanel: !isMobile && appState.showContactsPanel,
        showChatPanel: !isMobile && appState.showChatPanel,
    });

    Storage.setSetting('media.currentConference', resp.tag);

    ringer.Ring(RingType.Dial);

    startMic();
    startCam();
}

function handleDisconnectFromConference() {
    log('🛠️ disconnecting from conference received');
    disconnectFromConference();
}

function handleCallRequest(req) {
    if (!ctrl || !req) return;

    const reqType = Number(req.type || 0);
    const peerId = Number(req.id || 0);
    const peerConnectionId = Number(req.connection_id || 0);
    const peerName = req.name || (peerId ? `Контакт #${peerId}` : 'Неизвестный контакт');
    const callName = req.name || '';

    if (reqType === CALL_REQUEST_TYPE.Cancel) {
        if (appState.activeCall?.type === 'p2p' && appState.activeCall?.direction === 'incoming') {
            _resolveModal(false);
            if (ringer.Started()) ringer.Stop();
            setState({ activeCall: null });
        }
        return;
    }

    if (reqType !== CALL_REQUEST_TYPE.Invocation) return;

    if (appState.activeCall || ctrl.getCurrentConference()) {
        ctrl.sendCallResponse({
            id: peerId,
            connection_id: peerConnectionId,
            type: CALL_RESPONSE_TYPE.Busy,
            name: callName,
        });
        return;
    }

    incomingCallToken += 1;
    const token = incomingCallToken;

    setState({
        activeContactType: 'member',
        activeContactId: peerId || null,
        activeConferenceTag: null,
        activeCall: {
            type: 'p2p',
            status: 'ringing',
            direction: 'incoming',
            peerId,
            peerName,
            peerConnectionId,
            callName,
            timeLimit: req.time_limit || 0,
        }
    });

    ringer.Ring(RingType.CallIn);

    confirmDialog({
        title: 'Входящий звонок',
        message: `Звонок от ${peerName}. Принять?`,
        okText: 'Принять',
        cancelText: 'Отклонить',
    }).then((accepted) => {
        if (token !== incomingCallToken) return;

        if (ringer.Started()) ringer.Stop();

        if (accepted) {
            ctrl.sendCallResponse({
                id: peerId,
                connection_id: peerConnectionId,
                type: CALL_RESPONSE_TYPE.Accept,
                name: callName,
            });
            setState({
                activeCall: {
                    ...(appState.activeCall || {}),
                    status: 'connecting',
                }
            });
        } else {
            ctrl.sendCallResponse({
                id: peerId,
                connection_id: peerConnectionId,
                type: CALL_RESPONSE_TYPE.Refuse,
                name: callName,
            });
            setState({ activeCall: null });
        }
    });
}

function handleCallResponse(resp) {
    if (!ctrl || !resp) return;

    const respType = Number(resp.type || 0);
    const peerId = Number(resp.id || 0);
    const peerConnectionId = Number(resp.connection_id || 0);

    switch (respType) {
        case CALL_RESPONSE_TYPE.Accept: {
            if (ringer.Started()) ringer.Stop();

            const existingConf = ctrl.getCurrentConference();
            if (!existingConf) {
                const tag = randomTag(10);
                pendingInvite = { peerId, peerConnectionId, tag };
                ctrl.sendCreateTempConference(tag);
            } else {
                ctrl.sendConnectToConferenceInvite({
                    tag: existingConf.tag,
                    connecter_id: peerId,
                    connecter_connection_id: peerConnectionId,
                    flags: SEND_CONNECT_FLAGS.InviteCall
                });
            }

            setState({
                activeCall: {
                    ...(appState.activeCall || {}),
                    type: 'p2p',
                    status: 'connecting',
                    peerId,
                    peerConnectionId,
                }
            });
            break;
        }
        case CALL_RESPONSE_TYPE.Refuse:
            if (ringer.Started()) ringer.Stop();
            setState({ activeCall: null });
            showOk('Звонок', 'Абонент отклонил звонок');
            break;
        case CALL_RESPONSE_TYPE.Busy:
            if (ringer.Started()) ringer.Stop();
            setState({ activeCall: null });
            showOk('Звонок', 'Абонент занят');
            break;
        case CALL_RESPONSE_TYPE.Timeout:
            if (ringer.Started()) ringer.Stop();
            setState({ activeCall: null });
            showOk('Звонок', 'Абонент не ответил');
            break;
        case CALL_RESPONSE_TYPE.NotConnected:
            if (ringer.Started()) ringer.Stop();
            setState({ activeCall: null });
            showOk('Звонок', 'Абонент не в сети');
            break;
        default:
            break;
    }
}

function handleConferenceCreated(payload) {
    if (!payload?.tag || !pendingInvite) return;

    const { peerId, peerConnectionId, tag } = pendingInvite;
    if (payload.tag !== tag) return;

    ctrl.sendConnectToConferenceInvite({
        tag,
        connecter_id: peerId,
        connecter_connection_id: peerConnectionId,
        flags: SEND_CONNECT_FLAGS.InviteCall
    });

    pendingInvite = null;

    connectToConferenceByTag(tag, { type: 'p2p' });
}

function handleStartConnectToConference(payload) {
    if (!payload?.tag || ctrl.getCurrentConference()) return;

    const flags = Number(payload.flags || 0);

    if (flags === SEND_CONNECT_FLAGS.InviteCall) {
        connectToConferenceByTag(payload.tag, { type: 'p2p' });
        return;
    }

    if (flags === SEND_CONNECT_FLAGS.AddMember) {
        confirmDialog({
            title: 'Приглашение в конференцию',
            message: `Подключиться к конференции ${payload.tag}?`,
            okText: 'Подключиться',
            cancelText: 'Позже',
        }).then((accepted) => {
            if (accepted) {
                connectToConferenceByTag(payload.tag, { type: 'conference' });
            }
        });
    }
}

function handleDeviceConnected(device) {
    /* DeviceType {
       Undefined = 0,
       Camera, Demonstration, Avatar,
       Microphone,
       VideoRenderer, AudioRenderer
    };*/
    if (device.connect_type === 1 /* CreatedDevice */) {
        if (device.device_type == 1) { // Camera
            if (!cam) {
                console.warn('🛠️ [Cam] CreatedDevice received but local capture is not started; dropping device');
                ctrl.sendDisconnectDevice(device.device_id);
                return;
            }

            if (cam._wantDisconnectOnAttach) {
                ctrl.sendDisconnectDevice(device.device_id);
                cam.stop().catch(() => { });
                cam = null;
                setState({ camEnabled: false });
                return;
            }

            cam.attachRemote({
                server: ctrl.server,
                token: ctrl.authToken,
                deviceId: device.device_id,
                ssrc: device.author_ssrc,
                port: device.port,
                keyHex: device.secure_key,
            }).catch((e) => console.error('🛠️ [Cam] attachRemote failed', e));

            log(`🛠️ Camera attached id=${device.device_id} ssrc=${device.author_ssrc}`);
            return;
        }

        if (device.device_type == 2) { // Demonstration
            if (!scr) {
                console.warn('🛠️ [Screen] CreatedDevice received but local capture is not started; dropping device');
                ctrl.sendDisconnectDevice(device.device_id);
                return;
            }

            if (scr._wantDisconnectOnAttach) {
                ctrl.sendDisconnectDevice(device.device_id);
                scr.stop().catch(() => { });
                scr = null;
                setState({ demoEnabled: false });
                return;
            }

            scr.attachRemote({
                server: ctrl.server,
                token: ctrl.authToken,
                deviceId: device.device_id,
                ssrc: device.author_ssrc,
                port: device.port,
                keyHex: device.secure_key,
            }).catch((e) => console.error('🛠️ [Screen] attachRemote failed', e));

            log(`🛠️ Screen capture attached id=${device.device_id} ssrc=${device.author_ssrc}`);
            return;
        }

        if (device.device_type == 4) { // Microphone
            if (!mic) {
                console.warn('🛠️ [Microphone] CreatedDevice received but local capture is not started; dropping device');
                ctrl.sendDisconnectDevice(device.device_id);
                return;
            }

            mic.attachRemote({
                server: ctrl.server,
                token: ctrl.authToken,
                deviceId: device.device_id,
                ssrc: device.author_ssrc,
                port: device.port,
                keyHex: device.secure_key,
            }).catch((e) => console.error('🛠️ [Microphone] attachRemote failed', e));

            log(`🛠️ Microphone attached id=${device.device_id} ssrc=${device.author_ssrc}`);
            return;
        }
    } else if (device.connect_type === 2) {
        const key = `dev_${device.device_id}_${device.client_id}`;
        if (mediaSessions.has(key)) { log('🛠️ media already exists'); return; }

        if (device.my === 1 /*&& device.device_type === 4*/) {
            return;
        }

        // create media session
        const mediaUrl = ctrl.server; // server base
        const token = device.access_token || ctrl.authToken;
        const ms = new MediaChannel({
            url: mediaUrl,
            port: device.port,
            token,
            channelType: device.device_type !== 4 ? 'video' : 'audio',
            deviceId: device.device_id,
            clientId: device.client_id,
            label: device.name || key,
            receiver_ssrc: device.receiver_ssrc,
            author_ssrc: device.author_ssrc,
            cryptoKey: device.secure_key
        });

        mediaSessions.set(key, ms);

        if (ms.channelType === 'audio') {
            ms.initAudio()
                .then(() => ms.start())
                .catch(e => console.error('🛠️ [Call] initAudio failed', e));
        } else {
            ms.start((el) => {
                const container = document.getElementById('streams');
                if (!container) {
                    console.warn('🛠️ [Call] streams container not found');
                    return;
                }
                container.appendChild(el);
            });
        }
    }
}

function handleDeviceDisconnect(device) {
    const key = `dev_${device.device_id}_${device.client_id}`;
    const channel = mediaSessions.get(key);
    if (channel) {
        channel.stop();
        mediaSessions.delete(key);
        log('🛠️ channel closed: ' + key);
    }
    else if (cam && device.device_id == cam.deviceId) {
        cam.stop();
        cam = null;
        setState({ camEnabled: false });
        log('🛠️ camera disabled');
    }
    else if (scr && device.device_id == scr.deviceId) {
        scr.stop();
        scr = null;
        setState({ demoEnabled: false });
        log('🛠️ screen capture disabled');
    }
    else if (mic && device.device_id == mic.deviceId) {
        mic.stop();
        mic = null;
        setState({ micEnabled: false });
        log('🛠️ microphone disabled');
    }
}

function handleDeviceParams(dp) {
    let clientId = ctrl.getClientId();

    const device_connect = {
        connect_type: 1,              // CreatedDevice
        device_type: dp.device_type,
        device_id: dp.id,
        clientId,
        metadata: dp.metadata || "",
        author_ssrc: dp.ssrc,
        name: dp.name || "Browser Src",
        resolution: dp.resolution,
        color_space: dp.color_space,
        video_codec: dp.video_codec,
        audio_codec: dp.audio_codec
    };

    ctrl.sendCreatedDevice(device_connect);
}

async function handleNewMessage(newMsgs) {
    if (document.hidden === true) ringer.Ring(RingType.NewMessage);

    const m = newMsgs[newMsgs.length - 1];

    // минимально безопасный текст (чтобы не светить содержимое на лок-скрине)
    const title = m.author_name + ' пишет:';

    const msg = parsePayload(m.text);

    const body = String(msg.message).slice(0, 120);

    const data = {
        contact_type: m.conference_tag ? 'conference' : 'member',
        contact_id: m.author_id,
        conference_tag: m.conference_tag
    };

    showMessageNotification({
        title,
        body,
        data
    });

    if (document.hidden === false) await sendReaded();
}

function handleControlError(err) {
    if (appState.view === 'login') {
        showError(`Сервер ${ctrl.server} недоступен`);
        ctrl.disconnect();
    }
    log('🛠️ WSS error: ' + (err?.message || err?.type || String(err)));
}

function handleControlClose() {
    log('🛠️ Control connection ends');

    pendingInvite = null;
    incomingCallToken += 1;

    if (cam) cam.stop();
    cam = null;

    if (mic) mic.stop();
    mic = null;

    for (const [key, ch] of mediaSessions) {
        try { ch.stop(); } catch { }
    }
    mediaSessions.clear();

    setState({
        online: false,
        contactsView: 'contacts',
        activeCall: null,
        camEnabled: false,
        micEnabled: false,
    });
}

async function startLogin(server, login, password, opts = {}) {
    if (!server || !login) {
        showError('Укажите сервер и логин');
        return;
    }

    if (!password) {
        showError('Укажите пароль');
        return;
    }

    await initDataLayer(server, login);

    const ok = SessionStore.verifyOfflinePassword({ server, login, password });
    if (ok) {
        setState({ view: 'main' });
    }

    ctrl = new ControlWS({
        server,
        login,
        password,
        autoReconnect: true,
    });
    window.ctrl = ctrl;
    wireControlEvents();
}

/* ------------------------------------------------------------------
 * Медиа утилиты
 * ------------------------------------------------------------------ */

function pauseAllVideo() {
    for (const m of mediaSessions.values()) {
        if (m.channelType === 'video') {
            try { m.pauseForBackground(); } catch { }
        }
    }
}

function resumeAllVideo() {
    for (const m of mediaSessions.values()) {
        if (m.channelType === 'video') {
            try { m.resumeFromForeground(); } catch { }
        }
    }
}

async function startMic() {
    if (!ctrl) return;

    try {
        // Firefox ESR: если сессия уже существует, останавливаем её перед новой попыткой
        if (mic) {
            try { await mic.stop(); } catch { }
            mic = null;
        }

        // Firefox ESR: небольшая задержка для освобождения треков после Settings Panel
        await new Promise(r => setTimeout(r, 100));

        mic = new MicSession();
        mic.bus.on('speak_started', () => ctrl._send({ microphone_active: { active_type: 2, device_id: mic.deviceId, client_id: ctrl.client_id } }));
        mic.bus.on('speak_ended', () => ctrl._send({ microphone_active: { active_type: 1, device_id: mic.deviceId, client_id: ctrl.client_id } }));

        await mic.startLocalCapture();
        setState({ micEnabled: true });

        ctrl.sendDeviceParamsMic({ name: 'Browser Mic' });
    } catch (e) {
        console.error('🛠️ startMic error:', e);

        let msg = 'Не удалось получить доступ к микрофону.';

        if (e.name === 'NotReadableError') {
            msg = 'Микрофон уже используется другим приложением или устройством. Закройте другое приложение с микрофоном и попробуйте ещё раз.';
        } else if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
            msg = 'Доступ к микрофону запрещён. Разрешите доступ к микрофону в настройках браузера и перезагрузите страницу.';
        } else if (e.name === 'OverconstrainedError') {
            msg = 'Текущие настройки микрофона недоступны. Попробуйте другое разрешение или устройство.';
        }

        try { await mic?.stop?.(); } catch { }
        mic = null;
        setState({ micEnabled: false });

        showError(msg);
        log(msg);
    }
}

function stopMic() {
    if (!ctrl) return;
    if (mic) {
        // deviceId появляется после CreatedDevice от сервера
        if (mic.deviceId) {
            ctrl.sendDisconnectDevice(mic.deviceId);
        } else {
            //mic._wantDisconnectOnAttach = true;
        }

        mic.stop().catch(() => { });
        if (mic._speaking) { ctrl._send({ microphone_active: { active_type: 1, device_id: mic.deviceId, client_id: ctrl.client_id } }); }
        mic = null;
        setState({ micEnabled: false });
    }
}

async function startCam() {
    if (!ctrl) return;

    try {
        // Firefox ESR: если сессия уже существует, останавливаем её перед новой попыткой
        if (cam) {
            try { await cam.stop(); } catch { }
            cam = null;
        }

        // Firefox ESR: небольшая задержка для освобождения треков после Settings Panel
        await new Promise(r => setTimeout(r, 100));

        cam = new CameraSession();

        const { width, height } = await cam.startLocalCapture();
        const resolution = getResolution(width, height);

        // Сначала подняли устройство и узнали фактическое разрешение — теперь говорим серверу
        ctrl.sendDeviceParamsCam({ name: 'Browser Cam', resolution });
        setState({ camEnabled: true });
        const c = document.getElementById('localPreview');
        c?.classList.add('mirror-x');
        cam.setPreviewCanvas(c);
    } catch (e) {
        console.error('🛠️ startCam error:', e);

        let msg = 'Не удалось получить доступ к камере.';

        if (e.name === 'NotReadableError') {
            msg = 'Камера уже используется другим приложением или устройством. Закройте другое приложение с камерой и попробуйте ещё раз.';
        } else if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
            msg = 'Доступ к камере запрещён. Разрешите доступ к камере в настройках браузера и перезагрузите страницу.';
        } else if (e.name === 'OverconstrainedError') {
            msg = 'Текущие настройки камеры недоступны. Попробуйте другое разрешение или устройство.';
        }

        try { await cam?.stop?.(); } catch { }
        cam = null;
        setState({ camEnabled: false });

        showError(msg);
        log(msg);
    }
}

function stopCam() {
    if (!ctrl) return;
    if (cam) {
        // deviceId появляется после CreatedDevice от сервера
        if (cam.deviceId) {
            ctrl.sendDisconnectDevice(cam.deviceId);
        } else {
            cam._wantDisconnectOnAttach = true;
        }

        cam.stop().catch(() => { });
        cam = null;
        setState({ camEnabled: false });
    }
}

async function startScreenShare() {
    if (scr) return;

    try {
        scr = new ScreenSession();

        const { width, height } = await scr.startLocalCapture();
        const resolution = getResolution(width, height);

        ctrl.sendDeviceParamsScr({ name: 'Screen Capture', resolution });
        setState({ demoEnabled: true });
        scr.setPreviewCanvas(document.getElementById('demoPreview'));
    } catch (e) {
        console.error('🛠️ startScreenShare error:', e);

        let msg = 'Не удалось получить доступ к Захвату экрана';

        if (e.name === 'NotAllowedError' || e.name === 'AbortError' || e.name === 'SecurityError') {
            msg = 'Захват экрана отменён или запрещён. Разрешите доступ к захвату экрана и попробуйте ещё раз.';
        } else if (e.name === 'NotReadableError') {
            msg = 'Захват экрана сейчас недоступен. Закройте приложения/вкладки, которые могут мешать, и попробуйте ещё раз.';
        }

        try { await scr?.stop?.(); } catch { }
        scr = null;
        setState({ demoEnabled: false });

        showError(msg);
        log(msg);
    }
}

async function stopScreenShare() {
    if (!ctrl) return;
    if (scr) {
        if (scr.deviceId) {
            ctrl.sendDisconnectDevice(scr.deviceId);
        } else {
            scr._wantDisconnectOnAttach = true;
        }

        await scr.stop().catch(() => { });
        scr = null;
        setState({ demoEnabled: false });
    }
}
function disconnectFromConference() {
    if (!appState.activeCall) return;

    ScreenWakeLock.disable();

    pendingInvite = null;

    stopCam();
    stopMic();

    for (const [key, ch] of mediaSessions) {
        ctrl.sendDisconnectRenderer(ch.deviceId, ch.receiver_ssrc);
        try { ch.stop(); } catch { }
    }
    mediaSessions.clear();

    ctrl.sendDisconnectFromConference();

    if (!!appState.activeCall) {
        ringer.Ring(RingType.Hangup);
    }

    const isMobile = appState.layoutMode === 'mobile';

    setState({
        contactsView: 'contacts',
        activeCall: null,
        showContactsPanel: isMobile || appState.showContactsPanel,
        showChatPanel: !isMobile && appState.showChatPanel,
    });

    if (appState.online) {
        Storage.setSetting('media.currentConference', '');
    }

    log('🛠️ disconnected from conference');
}
