// src/ui/panels/settings_panel.js
import { appState, setState } from '../../core/app_state.js';
import { Storage } from '../../data/storage.js';
import { MicMonitor } from '../monitor/mic_monitor.js';

const SECTIONS = [
    ['camera', 'Камера'],
    ['mic', 'Микрофон'],
    ['speakers', 'Динамики'],
    ['connection', 'Подключение'],
    ['account', 'Аккаунт'],
    ['permissions', 'Разрешения'],
    ['general', 'Общие настройки'],
    ['recording', 'Запись'],
];

let devicesCache = null;
let devicesLoading = false;

const micMon = new MicMonitor();

let camPrev = {
    enabled: false,
    stream: null,
    deviceId: '',
    videoEl: null,
};

function attachCamPreviewEl(videoEl) {
    camPrev.videoEl = videoEl;
    if (camPrev.stream && camPrev.videoEl) {
        camPrev.videoEl.srcObject = camPrev.stream;
    }
}

async function stopCamPreview() {
    camPrev.enabled = false;

    if (camPrev.videoEl) {
        try { camPrev.videoEl.srcObject = null; } catch { }
    }
    if (camPrev.stream) {
        try { camPrev.stream.getTracks().forEach(t => t.stop()); } catch { }
    }

    camPrev.stream = null;
}

async function startCamPreview(deviceId) {
    camPrev.enabled = true;
    camPrev.deviceId = deviceId || '';

    // если уже играло — остановим
    await stopCamPreview();
    camPrev.enabled = true;
    camPrev.deviceId = deviceId || '';

    const video = {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 15 },
        resizeMode: 'crop-and-scale',
    };

    if (camPrev.deviceId) video.deviceId = { exact: camPrev.deviceId };
    // ВАЖНО: если deviceId пустой — ничего не добавляем (default камера)

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
        // fallback: если exact умер — default
        if (camPrev.deviceId) {
            console.warn('[settings] camera preview exact failed, fallback default:', e?.name || e);
            delete video.deviceId;
            stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } else {
            throw e;
        }
    }

    camPrev.stream = stream;

    if (camPrev.videoEl) {
        camPrev.videoEl.srcObject = stream;
        try { await camPrev.videoEl.play(); } catch { }
    }
}

function renderCamPreview() {
    return `
  <div class="settings-card">

  <div class="settings-cam-preview">
      <video id="settingsCamPreview" autoplay playsinline muted></video>
    </div>

    <div class="settings-hint">
      Если камера занята (идёт звонок/захват), браузер может вернуть “Device in use”.
    </div>
  </div>
`;
}
function bumpSettingsRender() {
    setState({ settingsRevision: (appState.settingsRevision || 0) + 1 });
}

function renderMicPreview() {
    return `
  <div class="settings-card">
    <div class="settings-mic-preview">
      <canvas id="settingsMicScope" width="600" height="140"></canvas>
    </div>
  </div>
`;
}

async function loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
        devicesCache = { error: 'enumerateDevices недоступен в этом браузере' };
        bumpSettingsRender();
        return;
    }
    if (devicesLoading) return;
    devicesLoading = true;
    try {
        const list = await navigator.mediaDevices.enumerateDevices();
        devicesCache = { list, at: Date.now() };
    } catch (e) {
        devicesCache = { error: e?.message || String(e) };
    } finally {
        devicesLoading = false;
        bumpSettingsRender();
    }
}

async function probeMedia(kind /* 'camera'|'mic'|'both' */) {
    try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia недоступен');

        const constraints =
            kind === 'camera' ? { video: true } :
                kind === 'mic' ? { audio: true } :
                    { audio: true, video: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(t => t.stop());
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
}

async function requestNotifications() {
    if (typeof Notification === 'undefined') return { ok: false, error: 'Notification API недоступен' };
    if (Notification.permission === 'granted') return { ok: true };
    if (Notification.permission === 'denied') return { ok: false, error: 'Разрешение уже запрещено в браузере' };
    const p = await Notification.requestPermission();
    return p === 'granted' ? { ok: true } : { ok: false, error: `permission=${p}` };
}

function getSetting(key, defVal) {
    return Storage.getSetting ? Storage.getSetting(key, defVal) : defVal;
}
function setSetting(key, val) {
    if (Storage.setSetting) return Storage.setSetting(key, val);
    // fallback: ничего не делаем (если у тебя settings ещё не подцеплены в Storage)
    return Promise.resolve();
}

function renderNav(active) {
    return `
    <div class="settings-nav">
      ${SECTIONS.map(([id, title]) => `
        <button class="settings-nav-btn ${active === id ? 'active' : ''}" data-action="settings:open" data-section="${id}">
          ${title}
        </button>
      `).join('')}
    </div>
  `;
}

function renderPermissions() {
    const notif = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    return `
    <div class="settings-section">
      <h3>Разрешения</h3>

      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label">Уведомления</div>
          <div class="settings-value">${notif}</div>
        </div>
        <div class="settings-actions">
          <button class="secondary" data-action="perm:notify">Запросить уведомления</button>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label">Камера / Микрофон</div>
          <div class="settings-value">Запрос через getUserMedia</div>
        </div>
        <div class="settings-actions">
          <button class="secondary" data-action="perm:camera">Запросить камеру</button>
          <button class="secondary" data-action="perm:mic">Запросить микрофон</button>
          <button class="secondary" data-action="perm:both">Запросить оба</button>
        </div>
      </div>

      <div class="settings-hint">
        Экран/окно (screen capture) браузер спрашивает только в момент старта демонстрации — заранее “разрешить” нельзя.
      </div>
    </div>
  `;
}

function renderDevices(kind /* video|audioinput|audiooutput */) {
    const title =
        kind === 'videoinput' ? 'Камера' :
            kind === 'audioinput' ? 'Микрофон' : 'Динамики';

    const selectedKey =
        kind === 'videoinput' ? 'media.cameraDeviceId' :
            kind === 'audioinput' ? 'media.micDeviceId' : 'media.speakerDeviceId';

    const selected = getSetting(selectedKey, '');

    let body = '';
    if (!devicesCache) {
        body = `<div class="settings-hint">Устройства не загружены.</div>`;
    } else if (devicesCache.error) {
        body = `<div class="settings-hint">Ошибка: ${devicesCache.error}</div>`;
    } else {
        const list = (devicesCache.list || []).filter(d => d.kind === kind);
        const options = list.map(d => {
            const label = d.label || `(без имени) ${d.deviceId.slice(0, 6)}…`;
            const sel = d.deviceId === selected ? 'selected' : '';
            return `<option value="${d.deviceId}" ${sel}>${label}</option>`;
        }).join('');

        body = `
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label">${title}</div>
          <div class="settings-value">${list.length} найдено</div>
        </div>

        ${kind === 'videoinput' ? renderCamPreview() : kind === 'audioinput' ? renderMicPreview() : ''}

        <label class="settings-field">
          <span>Используемое устройство</span>
          <select data-action="device:select" data-kind="${kind}" class="settings-select">
            <option value="">(по умолчанию)</option>
            ${options}
          </select>
        </label>

        <div class="settings-hint">
          На iOS/Android список может быть пустым до выдачи разрешений (раздел “Разрешения”).
        </div>
      </div>
    `;
    }

    return `
    <div class="settings-section">
      <h3>${title}</h3>

      <div class="settings-actions">
        <button class="secondary" data-action="devices:refresh">
          ${devicesLoading ? 'Обновляю…' : 'Обновить список устройств'}
        </button>
      </div>

      ${body}
    </div>
  `;
}

function renderConnection(state) {
    return `
    <div class="settings-section">
      <h3>Подключение</h3>

      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label">Сервер</div>
          <div class="settings-value">${state.auth?.server || '-'}</div>
        </div>
        <div class="settings-row">
          <div class="settings-label">Статус</div>
          <div class="settings-value">${state.online ? 'Онлайн' : 'Оффлайн'}</div>
        </div>
      </div>

      <div class="settings-hint">
        ---
      </div>
    </div>
  `;
}

function renderAccount(state) {
    const u = state.user || {};
    return `
    <div class="settings-section">
      <h3>Аккаунт</h3>

      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label">Логин</div>
          <div class="settings-value">${u.login || '-'}</div>
        </div>
        <div class="settings-row">
          <div class="settings-label">Имя</div>
          <div class="settings-value">${u.displayName || '-'}</div>
        </div>
      </div>

      <div class="settings-actions">
        <button id="btnLogout" class="secondary">Выйти</button>
      </div>
    </div>
  `;
}

function renderGeneral() {

    const notifEnabled = !!getSetting('ui.notificationsEnabled', true);
    return `
    <div class="settings-section">
      <h3>Общие настройки</h3>

      <div class="settings-card">
        <label class="settings-check">
          <input type="checkbox" data-action="ui:toggle" data-key="ui.notificationsEnabled" ${notifEnabled ? 'checked' : ''}>
          <span>Системные уведомления (когда вкладка скрыта)</span>
        </label>
      </div>

      <div class="settings-hint">
        Локальные привычки UI: вид сетка/спикер, автопереходы, и т.д.
      </div>
    </div>
  `;
}

function renderRecording() {
    return `
    <div class="settings-section">
      <h3>Запись</h3>
      <div class="settings-hint">
        Заглушка под будущее
      </div>
    </div>
  `;
}

function renderSection(section, state) {
    switch (section) {
        case 'permissions': return renderPermissions();
        case 'camera': return renderDevices('videoinput');
        case 'mic': return renderDevices('audioinput');
        case 'speakers': return renderDevices('audiooutput');
        case 'connection': return renderConnection(state);
        case 'account': return renderAccount(state);
        case 'recording': return renderRecording();
        case 'general':
        default: return renderGeneral();
    }
}

export function renderSettingsPanel(root, state) {
    if (!root) return;

    // Контейнер всегда существует, но содержимое показываем только когда нужно
    root.className = `settings-overlay ${state.showSettingsPanel ? 'open' : ''}`;

    if (!state.showSettingsPanel) {
        root.innerHTML = '';
        stopCamPreview();
        micMon.stop();
        return;
    }

    if (!devicesCache && !devicesLoading) {
        loadDevices(); // без await, оно само сделает bumpSettingsRender()
    }

    const section = state.settingsSection || 'general';
    const sectionTitle = (SECTIONS.find(([id]) => id === section)?.[1]) || 'Настройки';

    root.innerHTML = `
    <div class="settings-overlay-backdrop" data-action="settings:close"></div>

    <div class="settings-overlay-panel">
      <div class="settings-header">
        <div class="settings-header-left">
          <div class="settings-title">Настройки</div>
          <div class="settings-subtitle">${sectionTitle}</div>
        </div>
        <button class="panel-close-btn" data-action="settings:close" title="Закрыть">✕</button>
      </div>

      <div class="settings-body">
        ${renderNav(section)}
        <div class="settings-content">
          ${renderSection(section, state)}
        </div>
      </div>
    </div>
  `;

    const v = root.querySelector('#settingsCamPreview');
    if (v) {
        attachCamPreviewEl(v);
    }

    const micCanvas = root.querySelector('#settingsMicScope');
    if (micCanvas) micMon.setCanvas(micCanvas);

    if (section === 'camera') {
        startCamPreview(getSetting('media.cameraDeviceId', '')).catch(e =>
            console.warn('[settings] start preview failed', e?.name || e)
        );
    } else {
        stopCamPreview();
    }

    if (section == 'mic') {
        try {
            micMon.start({ deviceId: getSetting('media.micDeviceId', '') });
        } catch (e) {
            console.warn('[settings] mic monitor start failed:', e?.name || e);
        }
    } else {
        micMon.stop();
    }

    // Event delegation (чтобы не плодить обработчики)
    if (!root.dataset.bound) {
        root.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action], button');
            if (!btn) return;

            const action = btn.dataset.action || '';

            if (action === 'settings:close') {
                setState({ showSettingsPanel: false });
                return;
            }

            if (action === 'settings:open') {
                const sec = btn.dataset.section;
                setState({ settingsSection: sec });
                return;
            }

            if (action === 'devices:refresh') {
                await loadDevices();
                return;
            }

            if (action === 'device:select') {
                // селект ловим в change, не тут
                return;
            }

            if (action === 'perm:notify') {
                const r = await requestNotifications();
                if (!r.ok) console.warn('[perm] notify:', r.error);
                bumpSettingsRender();
                return;
            }

            if (action === 'perm:camera') {
                const r = await probeMedia('camera');
                if (!r.ok) console.warn('[perm] camera:', r.error);
                await loadDevices();
                return;
            }
            if (action === 'perm:mic') {
                const r = await probeMedia('mic');
                if (!r.ok) console.warn('[perm] mic:', r.error);
                await loadDevices();
                return;
            }
            if (action === 'perm:both') {
                const r = await probeMedia('both');
                if (!r.ok) console.warn('[perm] both:', r.error);
                await loadDevices();
                return;
            }
        });

        root.addEventListener('change', async (e) => {
            const sel = e.target.closest('select[data-action="device:select"]');
            if (sel) {
                const kind = sel.dataset.kind;
                const v = sel.value || '';

                const key =
                    kind === 'videoinput' ? 'media.cameraDeviceId' :
                        kind === 'audioinput' ? 'media.micDeviceId' :
                            'media.speakerDeviceId';

                await setSetting(key, v);

                if (sel && sel.dataset.kind === 'videoinput') {
                    if (camPrev.enabled) {
                        try { await startCamPreview(sel.value || ''); } catch (e) {
                            console.warn('[settings] cam preview restart failed:', e?.name || e);
                        }
                    }
                }
                if (sel && sel.dataset.kind === 'audioinput') {
                    try {
                        await micMon.start({ deviceId: getSetting('media.micDeviceId', '') });
                    } catch (e) {
                        console.warn('[settings] mic monitor start failed:', e?.name || e);
                    }
                }
                return;
            }

            const chk = e.target.closest('input[type="checkbox"][data-action="ui:toggle"]');
            if (chk) {
                const key = chk.dataset.key;
                await setSetting(key, !!chk.checked);
                return;
            }
        });

        root.dataset.bound = '1';
    }
}
