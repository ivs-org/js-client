/**
 * app.js - The VideoGrace Web Client Application
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

"use strict";

import { Storage } from './data/storage.js';
import { MemberList } from './data/member_list.js';
import { MessagesStorage, setSelfId as messagesSetSelfId } from './data/messages_storage.js';
import { initLayout } from './ui/layout.js';
import { setState, appState } from './core/app_state.js';
import { registerUserViaHttp, interpretRegistrationResult } from './transport/registration_http.js';
import { showModal, showError } from './ui/modal.js';
import { ControlWS } from './transport/control_ws.js';
import { MediaChannel } from './media/media_channel.js';
import { AudioShared } from './media/audio/audio_shared.js';
import { MicrophoneSession } from './media/audio/mic_session.js';
import { CameraSession } from './media/video/cam_session.js';
import { ScreenSession } from './media/video/screen_session.js';
import { getResolution } from './media/video/resolution.js';
import { Ringer } from './ui/ringer/ringer.js';
import { RingType } from './ui/ringer/ring_type.js';


const MOBILE_BREAKPOINT = 900;

let mic = null;
let cam = null;
let scr = null;

const urlParams = new URLSearchParams(location.search);
window.confTag = urlParams.get('conf') || 'show';

function log(s) {
    const t = new Date().toISOString().slice(11, 23);
    console.debug(s);
}

let ctrl = null;
let ctrlEventUnsubscribers = [];

const mediaSessions = new Map();

export const ringer = new Ringer({ baseUrl: '/assets/sounds', volume: 0.9 });

/* ------------------------------------------------------------------
 * STORAGE: localStorage вместо cookie
 * ------------------------------------------------------------------ */

function loadStoredCreds() {
    try {
        const raw = localStorage.getItem('vg_client');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function initDataLayer() {
    await Storage.init();

    Storage.subscribe(() => {
        setState({
            contactsRevision: (appState.contactsRevision || 0) + 1,
        });
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

/* ------------------------------------------------------------------
 * Точка входа
 * ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
    AudioShared.ensureContext();
    AudioShared.ensureWorklet();

    if (!checkWebCodecs()) return;

    console.log('🎧 Initializing audio playback...');

    // общий AudioContext (один на всё приложение)
    const audioCtx = AudioShared.ensureContext();
    AudioShared.ensureWorklet(); // фоновая предзагрузка, если еще не была

    // Для AEC AudioContext должен быть активирован пользователем
    document.body.addEventListener('click', async () => {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
            console.log('AudioContext resumed');
        }
    }, { once: true });

    await initDataLayer();
    initResponsiveLayout();
    initLayout();
    initButtonsPanelActions();
    initAuthEvents();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker зарегистрирован'))
            .catch(err => console.error('Ошибка регистрации Service Worker:', err));
    }
});

/* ------------------------------------------------------------------
 * Push подписка
 * ------------------------------------------------------------------ */

function sendSubscriptionToBackend(sub) {
    // TODO: сюда нужен реальный запрос на бэк
    console.log('sendSubscriptionToBackend stub:', sub);
}

function subscribeUserToPush() {
    navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
            if (subscription) {
                console.log('Пользователь уже подписан. Объект подписки:', subscription);
            } else {
                console.log('Пользователь еще не подписан. Запуск подписки...');

                const applicationServerKey = 'BNOLt7sJq9bx0bv2eXhcQMykHzA7_uSqpDCQREKxe-P0LRy4qQeN9eP11QZVLna916kcl116uQZzrMT2ABuTXbg';

                registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                })
                    .then(newSubscription => {
                        console.log('Пользователь успешно подписан:', newSubscription);
                        sendSubscriptionToBackend(newSubscription);
                    })
                    .catch(err => {
                        console.error('Не удалось подписаться на уведомления:', err);
                    });
            }
        });
    });
}

/* ------------------------------------------------------------------
 * Mobile helpers
 * ------------------------------------------------------------------ */

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

            console.log('changed mode to: ', newMode);

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
}

/* ------------------------------------------------------------------
 * Основные кнопки UI
 * ------------------------------------------------------------------ */

function handleJoinConferenceClick() {
    const { activeContactType, activeContactId, activeConferenceTag } = appState;
    if (activeContactType !== 'conference' || !activeContactId) {
        // ничего не выбрано
        return;
    }

    const conf = Storage.getConference(activeContactId);
    if (!conf) return;

    const tag = conf.tag || activeConferenceTag;

    ctrl.sendConnectToConference(tag);
}

function initButtonsPanelActions() {
    // Делегирование: ловим клики по кнопкам панели управления по id
    document.addEventListener('click', (event) => {
        const el = event.target;
        if (!(el instanceof HTMLElement)) return;

        const btn = el.closest('button');
        if (!btn) return;

        switch (btn.id) {
            case 'btnToggleCall':
                if (!ctrl || !appState.online) return;
                if (!ctrl.getCurrentConference()) {
                    // Подключиться
                    //let conf = appState.activeContactId ? appState.activeContactId : window.confTag;
                    //ctrl.sendConnectToConference(conf);
                    handleJoinConferenceClick();
                } else {
                    // Отключиться
                    disconnectFromConference();
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
                disconnectFromConference();
                if (ctrl) ctrl.disconnect();
                for (const m of mediaSessions.values()) m.close();
                mediaSessions.clear();
                
                setState({ view: 'login' });
        }
    });
}

/* ------------------------------------------------------------------
 * Регистрация
 * ------------------------------------------------------------------ */

function initAuthEvents() {
    // Логин
    document.addEventListener('app:login', (e) => {
        const { server, login, password } = e.detail || {};

        setState({
            auth: {
                server: server || '',
                login: login || '',
                password: '',
            }
        });

        startLoginFromUI(server, login, password);
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

            showModal(
                'Регистрация',
                'Регистрация успешна. Теперь вы можете войти под указанным логином.'
            );

            // возвращаемся на экран логина и префилим сервер/логин
            setState({
                view: 'login',
                auth: {
                    server: server || '',
                    login: login || '',
                    password: '',
                }
            });
        } catch (err) {
            console.error('registration error', err);
            showError('Ошибка регистрации: ' + (err.message || 'неизвестная ошибка'));
        }
    });
}

/* ------------------------------------------------------------------
 * WebCodecs проверка
 * ------------------------------------------------------------------ */

function checkWebCodecs() {
    if (!('VideoDecoder' in window) || !('AudioDecoder' in window)) {
        showError('WebCodecs недоступны. Пожалуйста, используйте HTTPS или localhost.');
        return false;
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        showError('WebCodecs доступны только в безопасном контексте (HTTPS или localhost).');
        return false;
    }
    const sabAvailable = typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated;

    if (!sabAvailable) {
        showError('SharedArrayBuffer не доступен, сервер не настроен на CORS');
        return false;
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
        ctrl.on('auth', handleControlAuth),
        ctrl.on('connectToConferenceResponse', handleConnectToConferenceResponse),
        ctrl.on('disconnectFromConference', handleDisconnectFromConference),
        ctrl.on('ping', () => { }),
        ctrl.on('deviceConnected', handleDeviceConnected),
        ctrl.on('deviceDisconnect', handleDeviceDisconnect),
        ctrl.on('deviceParams', handleDeviceParams),
        ctrl.on('new_message', handleNewMessage),
        ctrl.on('error', handleControlError),
        ctrl.on('close', handleControlClose),
    );
}

function handleControlAuth(token) {
    log('auth ok token received');

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

    log('connected_to_conference: ' + resp.name);

    const isMobile = appState.layoutMode === 'mobile';
    
    setState({
        contactsView: 'members',
        activeCall: {
            tag: resp.tag,
            name: resp.name,
            status: 'connected'
        },
        showContactsPanel: !isMobile && appState.showContactsPanel,
        showChatPanel: !isMobile && appState.showChatPanel,
    });

    localStorage.setItem('vg_current_conf', resp.tag);

    ringer.Ring(RingType.Dial);

    startMic();
    startCam();
}

function handleDisconnectFromConference() {
    log('disconnecting from conference received');
    disconnectFromConference();
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
                console.warn('[Cam] CreatedDevice received but local capture is not started; dropping device');
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
            }).catch((e) => console.error('[Cam] attachRemote failed', e));

            log(`Camera attached id=${device.device_id} ssrc=${device.author_ssrc}`);
            return;
        }

        if (device.device_type == 2) { // Demonstration
            if (!scr) {
                console.warn('[Screen] CreatedDevice received but local capture is not started; dropping device');
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
            }).catch((e) => console.error('[Screen] attachRemote failed', e));

            log(`Screen capture attached id=${device.device_id} ssrc=${device.author_ssrc}`);
            return;
        }

        if (device.device_type == 4) { // Microphone
            mic = new MicrophoneSession({
                server: ctrl.server,
                token: ctrl.authToken,
                deviceId: device.device_id,
                ssrc: device.author_ssrc,
                port: device.port,
                keyHex: device.secure_key,
                channels: 1
            });

            mic.start();
            setState({ micEnabled: true });
            log(`Microphone started id=${device.device_id} ssrc=${device.author_ssrc}`);
        }
    } else if (device.connect_type === 2) {
        const key = `dev_${device.device_id}_${device.client_id}`;
        if (mediaSessions.has(key)) { log('media already exists'); return; }

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
        if (ms.channelType === 'audio') {
            ms._initAudio();
        }
        mediaSessions.set(key, ms);
        ms.start((el) => {
            const container = document.getElementById('streams');
            if (!container) {
                console.warn('[Call] streams container not found');
                return;
            }
            container.appendChild(el);
        });
    }
}

function handleDeviceDisconnect(device) {
    const key = `dev_${device.device_id}_${device.client_id}`;
    const channel = mediaSessions.get(key);
    if (channel) {
        channel.stop();
        mediaSessions.delete(key);
        log('channel closed: ' + key);
    }
    else if (cam && device.device_id == cam.deviceId) {
        cam.stop();
        cam = null;
        setState({ camEnabled: false });
        log('camera disabled');
    }
    else if (scr && device.device_id == scr.deviceId) {
        scr.stop();
        scr = null;
        setState({ demoEnabled: false });
        log('screen capture disabled');
    }
    else if (mic && device.device_id == mic.deviceId) {
        mic.stop();
        mic = null;
        setState({ micEnabled: false });
        log('microphone disabled');
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

function handleNewMessage() {
    ringer.Ring(RingType.NewMessage);
}

function handleControlError(err) {
    if (appState.view === 'login') {
        showError(`Сервер ${appState.auth.server} недоступен`);
    }
    log('WSS error: ' + err);
}

function handleControlClose() {
    log('Control connection ends');

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

function startLoginFromUI(server, login, pass, opts = {}) {
    if (!server || !login) {
        showError('Укажите сервер и логин');
        return;
    }

    if (!pass) {
        showError('Укажите пароль');
        return;
    }

    const stored = loadStoredCreds();
    if (stored) {
        if (stored.login == login && stored.pass == pass) {
            setState({ view: 'main' });
        } else {
            showError('Неверный логин или пароль');
        }
    }

    ctrl = new ControlWS({
        server,
        login,
        password: pass,
        autoReconnect: true,
    });
    window.ctrl = ctrl;
    wireControlEvents();
}

/* ------------------------------------------------------------------
 * Автолигин из storage
 * ------------------------------------------------------------------ */

(function tryAutoFromStorage() {
    const stored = loadStoredCreds();
    if (stored && stored.autoLogin) {
        startLoginFromUI(stored.server, stored.login, stored.pass);
    }
})();

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

function startMic() {
    ctrl.sendDeviceParamsMic({ name: 'Browser Mic' });
}

function stopMic() {
    if (!ctrl) return;
    if (mic) {
        ctrl.sendDisconnectDevice(mic.deviceId);
    }
}

async function startCam() {
    if (!ctrl) return;

    try {
        if (!cam) {
            cam = new CameraSession();
        }

        const { width, height } = await cam.startLocalCapture();
        const resolution = getResolution(width, height);

        // Сначала подняли устройство и узнали фактическое разрешение — теперь говорим серверу
        ctrl.sendDeviceParamsCam({ name: 'Browser Cam', resolution });
        setState({ camEnabled: true });
        const c = document.getElementById('localPreview');
        c?.classList.add('mirror-x');
        cam.setPreviewCanvas(c);
    } catch (e) {
        console.error('startCam error:', e);

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
        console.error('startScreenShare error:', e);

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
        localStorage.removeItem('vg_current_conf');
    }

    log('disconnected from conference');
}
