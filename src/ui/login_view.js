// src/ui/login_view.js
import { appState, setState } from '../core/app_state.js';
import { SessionStore, normalizeServer } from '../data/session_store.js';
import { UrlBoot } from '../core/url_boot.js';
import { confirmDialog, showError } from '../ui/modal.js';

export function renderLoginView(root, state) {
    if (!root) return;

    const auth = (state && state.auth) ? state.auth : (appState.auth || {});
    const serverFromState = (auth.server || '').trim();
    const loginFromState = (auth.login || '').trim();

    const bootServer = String(UrlBoot.getBootServer?.() || '').trim(); // host
    const isBootLocked = !!bootServer;

    const sessions = SessionStore.listSessions();                  // [{key, server, login, pass, lastUsedAt}]
    const activeKey = String(SessionStore.getActiveKey?.() || ''); // per-tab
    const mostRecentKey = String(SessionStore.getMostRecentKey?.() || '');

    // initialKey:
    // - если сервер задан ссылкой: берём самую свежую сессию ТОЛЬКО на этом сервере
    // - иначе: auth.sessionKey -> activeKey -> mostRecentKey
    let initialKey = String(auth.sessionKey || '').trim();
    if (isBootLocked) {
        initialKey = getMostRecentKeyForServer(sessions, bootServer) || '';
    } else {
        if (!initialKey) initialKey = activeKey.trim();
        if (!initialKey) initialKey = mostRecentKey.trim();
    }

    // сгруппировать по server
    const byServer = new Map(); // server -> sessions[]
    for (const s of sessions) {
        if (!s?.server || !s?.login) continue;
        const srv = String(s.server).toLowerCase();
        if (!byServer.has(srv)) byServer.set(srv, []);
        byServer.get(srv).push(s);
    }
    for (const arr of byServer.values()) {
        arr.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
    }

    const selectOptions = renderSessionOptions(byServer, initialKey, {
        lockedServer: isBootLocked ? bootServer : ''
    });

    const effectiveServer = isBootLocked ? bootServer : (serverFromState || '');

    root.innerHTML = `
      <div class="auth-shell">
        <div class="auth-hero" aria-hidden="true">
          <div class="auth-hero-inner">
            <div class="auth-hero-logo">VG</div>
            <div class="auth-hero-bottom">
              <div class="auth-hero-title">VideoGrace</div>
              <div class="auth-hero-sub">
                Вход в рабочий контур. Без лишних движений — кроме полезных.
              </div>
            </div>
          </div>
        </div>

        <div class="auth-panel">
          <div class="auth-card">
            <h1 class="auth-title">Вход</h1>

            <div class="auth-field">
              <label>Сохранённые сессии</label>

              <div id="bootBanner" class="auth-hint"></div>

              <div class="auth-row">
                <select id="sessionSelect" class="auth-select">
                  ${selectOptions}
                </select>

                <button id="btnDeleteSession"
                        class="auth-icon-btn"
                        type="button"
                        title="Удалить выбранный логин">✕</button>
              </div>

              <div id="sessionMeta" class="auth-hint"></div>
            </div>

            <div class="auth-field">
              <label for="loginServer">Сервер</label>
              <input id="loginServer" type="text"
                     placeholder="vks.example.com"
                     value="${escapeHtml(effectiveServer)}" />
            </div>

            <div class="auth-field">
              <label for="loginLogin">Логин</label>
              <input id="loginLogin" type="text"
                     value="${escapeHtml(loginFromState)}" />
            </div>

            <div class="auth-field">
              <label for="loginPassword">Пароль</label>
              <input id="loginPassword" type="password" />
            </div>

            <div class="auth-actions">
              <button id="btnLoginSubmit" type="button">Войти</button>
            </div>

            <div class="auth-switch">
              Нет аккаунта?
              <button type="button" id="lnkOpenRegister" class="link-btn">Регистрация</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const bootEl = root.querySelector('#bootBanner');
    const sessionEl = root.querySelector('#sessionSelect');
    const metaEl = root.querySelector('#sessionMeta');
    const delEl = root.querySelector('#btnDeleteSession');

    const serverEl = root.querySelector('#loginServer');
    const loginEl = root.querySelector('#loginLogin');
    const passEl = root.querySelector('#loginPassword');
    const submitEl = root.querySelector('#btnLoginSubmit');
    const regLink = root.querySelector('#lnkOpenRegister');

    if (!sessionEl || !serverEl || !loginEl || !passEl || !submitEl) return;

    // --- URL lock banner + server lock
    if (isBootLocked) {
        serverEl.value = bootServer;
        serverEl.disabled = true;
        renderBootBanner(bootEl, bootServer);
    } else {
        serverEl.disabled = false;
        if (bootEl) bootEl.textContent = '';
    }

    // --- initial apply (NO setState here!)
    if (initialKey) {
        const s = SessionStore.getByKey(initialKey);
        if (s && (!isBootLocked || String(s.server).toLowerCase() === String(bootServer).toLowerCase())) {
            sessionEl.value = initialKey;
            applySessionToInputs(s, serverEl, loginEl, passEl, { lockedServer: isBootLocked ? bootServer : '' });
            updateMeta(metaEl, s, activeKey, mostRecentKey);
        } else {
            updateMeta(metaEl, null, activeKey, mostRecentKey);
        }
    } else {
        updateMeta(metaEl, null, activeKey, mostRecentKey);
    }

    // --- handlers (here setState is OK, but we use it only for view switches)
    sessionEl.addEventListener('change', () => {
        const key = sessionEl.value || '';
        const s = key ? SessionStore.getByKey(key) : null;

        // safety: при URL-локе не даём выбрать чужой сервер
        if (isBootLocked && s && String(s.server).toLowerCase() !== String(bootServer).toLowerCase()) {
            sessionEl.value = '';
            updateMeta(metaEl, null, activeKey, mostRecentKey);
            return;
        }

        if (s) {
            applySessionToInputs(s, serverEl, loginEl, passEl, { lockedServer: isBootLocked ? bootServer : '' });
            updateMeta(metaEl, s, activeKey, mostRecentKey);
        } else {
            updateMeta(metaEl, null, activeKey, mostRecentKey);
        }
    });

    // удалить выбранный логин
    delEl?.addEventListener('click', async () => {
        const key = sessionEl.value || '';
        if (!key) return;

        const s = SessionStore.getByKey(key);
        if (!s) return;

        const ok = await confirmDialog({
            title: 'Удалить сохранённый вход?',
            message: `Сессия будет удалена:\n${s.server} / ${s.login}\n\nЛокальная база (IndexedDB) тоже будет удалена.`,
            okText: 'Удалить',
            cancelText: 'Отмена',
            avatarUrl: '',
            avatarLetter: (s.login || '?')[0]?.toUpperCase() || '?',
        });

        if (!ok) return;

        const res = await SessionStore.removeWithDb(key);
        if (res?.db?.reason === 'blocked') {
            showError('Локальная база данных будет удалена когда вы закроете вкладку или обновите страницу');
        }

        // перерисуем экран, чтобы обновить optgroup/options
        setState({ view: 'login' });
    });

    // submit
    submitEl.addEventListener('click', () => {
        const srv = isBootLocked ? bootServer : normalizeServer(serverEl.value.trim());
        const lg = loginEl.value.trim();
        const pw = passEl.value;

        const payload = { server: srv, login: lg, password: pw, sessionKey: sessionEl.value || '' };
        document.dispatchEvent(new CustomEvent('app:login', { detail: payload }));
    });

    passEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitEl.click();
        }
    });

    regLink?.addEventListener('click', () => setState({ view: 'register', auth: { ...state.auth, server: serverEl.value } }));

    // banner actions
    bootEl?.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;

        if (t.id === 'btnBootClear') {
            UrlBoot.clearBootServer?.();
            setState({ view: 'login' });
        }
    });
}

function getMostRecentKeyForServer(sessions, server) {
    const srv = String(server || '').toLowerCase();
    if (!srv) return '';

    let bestKey = '';
    let bestTs = 0;

    for (const s of sessions || []) {
        if (!s?.key) continue;
        if (String(s.server || '').toLowerCase() !== srv) continue;
        const ts = s.lastUsedAt || 0;
        if (ts > bestTs) { bestTs = ts; bestKey = s.key; }
    }
    return bestKey;
}

function renderBootBanner(el, bootServer) {
    if (!el) return;

    const srv = escapeHtml(bootServer || '');
    el.innerHTML = `
      <span>Сервер задан ссылкой: <b>${srv}</b>.</span>
      <button id="btnBootClear" type="button" class="link-btn" style="margin-left:10px;">
        Снять привязку
      </button>
    `;
}

function renderSessionOptions(byServer, selectedKey, { lockedServer = '' } = {}) {
    const locked = String(lockedServer || '').toLowerCase();

    let html = `<option value="">— выбрать —</option>`;

    const servers = Array.from(byServer.keys()).sort((a, b) => a.localeCompare(b));
    for (const srv of servers) {
        const items = byServer.get(srv) || [];
        const isDisabled = !!(locked && srv !== locked);

        html += `<optgroup label="${escapeHtml(srv)}"${isDisabled ? ' disabled' : ''}>`;

        for (const s of items) {
            const key = s.key;
            const sel = (key && key === selectedKey) ? ' selected' : '';
            const last = s.lastUsedAt ? formatDt(s.lastUsedAt) : '';
            const label = last ? `${s.login} · ${last}` : `${s.login}`;
            html += `<option value="${escapeAttr(key)}"${sel}>${escapeHtml(label)}</option>`;
        }

        html += `</optgroup>`;
    }

    return html;
}

function applySessionToInputs(sess, serverEl, loginEl, passEl, { lockedServer = '' } = {}) {
    const locked = String(lockedServer || '').trim();
    serverEl.value = locked ? locked : (sess.server || '');
    loginEl.value = sess.login || '';
    passEl.value = sess.pass || '';
}

function updateMeta(metaEl, sess, activeKey, mostRecentKey) {
    if (!metaEl) return;

    const isActive = sess?.key && sess.key === activeKey;
    const isMostRecent = sess?.key && sess.key === mostRecentKey;

    if (!sess) {
        metaEl.textContent = '';
        return;
    }

    const parts = [];
    if (sess.lastUsedAt) parts.push(`последний вход: ${formatDt(sess.lastUsedAt)}`);
    if (isActive) parts.push('активно в этой вкладке');
    else if (isMostRecent) parts.push('самая свежая');

    metaEl.textContent = parts.join(' · ');
}

function formatDt(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return ''; }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
}
