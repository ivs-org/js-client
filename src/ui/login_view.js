// src/ui/login_view.js
import { appState, setState } from '../core/app_state.js';
import { SessionStore, normalizeServer } from '../data/session_store.js';
import { confirmDialog, showError } from '../ui/modal.js';

export function renderLoginView(root, state) {
    if (!root) return;

    const auth = (state && state.auth) ? state.auth : (appState.auth || {});
    const server = auth.server || '';
    const login = auth.login || '';

    const sessions = SessionStore.listSessions();           // [{key, server, login, pass, lastUsedAt}]
    const activeKey = SessionStore.getActiveKey();          // per-tab
    const mostRecentKey = SessionStore.getMostRecentKey();  // for UI hints

    // выберем стартовую опцию селекта:
    // 1) то, что уже в auth.sessionKey
    // 2) активная вкладочная
    // 3) просто самая свежая (для подсказки, НЕ для автологина)
    let initialKey = (auth.sessionKey || '').trim();
    if (!initialKey) initialKey = (activeKey || '').trim();
    if (!initialKey) initialKey = (mostRecentKey || '').trim();

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

    const selectOptions = renderSessionOptions(byServer, initialKey);

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
                     value="${escapeHtml(server)}" />
            </div>

            <div class="auth-field">
              <label for="loginLogin">Логин</label>
              <input id="loginLogin" type="text"
                     value="${escapeHtml(login)}" />
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

    const sessionEl = root.querySelector('#sessionSelect');
    const metaEl = root.querySelector('#sessionMeta');
    const delEl = root.querySelector('#btnDeleteSession');

    const serverEl = root.querySelector('#loginServer');
    const loginEl = root.querySelector('#loginLogin');
    const passEl = root.querySelector('#loginPassword');
    const submitEl = root.querySelector('#btnLoginSubmit');
    const regLink = root.querySelector('#lnkOpenRegister');

    if (!sessionEl || !serverEl || !loginEl || !passEl || !submitEl) return;

    // применим initialKey (и обновим мету) если он реально существует
    if (initialKey) {
        const s = SessionStore.getByKey(initialKey);
        if (s) {
            sessionEl.value = initialKey;
            applySessionToInputs(s, serverEl, loginEl, passEl);
        }
    }
    updateMeta(metaEl, SessionStore.getByKey(sessionEl.value), activeKey, mostRecentKey);

    // если выбирают из селекта — подставляем поля и сохраняем sessionKey в state (для UI)
    sessionEl.addEventListener('change', () => {
        const key = sessionEl.value || '';
        const s = key ? SessionStore.getByKey(key) : null;

        if (s) {
            applySessionToInputs(s, serverEl, loginEl, passEl);
            setState({ auth: { ...(state.auth || {}), server: s.server, login: s.login, sessionKey: key } });
        } else {
            setState({ auth: { ...(state.auth || {}), sessionKey: '' } });
        }

        updateMeta(metaEl, s, activeKey, mostRecentKey);
    });

    // если юзер руками меняет server/login — это уже “новая сессия”, селект сбрасываем
    const clearSelect = () => {
        if (sessionEl.value) {
            sessionEl.value = '';
            updateMeta(metaEl, null, activeKey, mostRecentKey);
            setState({ auth: { ...(state.auth || {}), sessionKey: '' } });
        }
    };

    // удалить выбранный логин
    delEl?.addEventListener('click', async () => {
        const key = sessionEl.value || '';
        if (!key) return;

        const s = SessionStore.getByKey(key);
       
        let ok = await confirmDialog({
            title: 'Удалить сохранённый вход?',
            message: `Сессия будет удалена:\n${s.server} / ${s.login}`,
            okText: 'Удалить',
            cancelText: 'Отмена',
            avatarUrl: '',                               // если у логина/юзера есть аватар — подставишь
            avatarLetter: (s.login || '?')[0]?.toUpperCase() || '?',
        });

        if (!ok) return;

        const res = await SessionStore.removeWithDb(key);
        if (res.db?.reason === 'blocked') {
            showError('Локальная база данных будет удалена когда вы закроете вкладку или обновите страницу');
        }

        // если удалили текущую выбранную — очистим поля аккуратно, оставим server/login как есть
        sessionEl.value = '';
        updateMeta(metaEl, null, activeKey, mostRecentKey);

        // форс-рендер (чтобы optgroup пересобрались)
        setState({ view: 'login' });
    });

    // submit
    submitEl.addEventListener('click', () => {
        const payload = {
            server: normalizeServer(serverEl.value.trim()),
            login: loginEl.value.trim(),
            password: passEl.value,
            // sessionKey здесь не обязателен, но удобно передать
            sessionKey: sessionEl.value || ''
        };

        document.dispatchEvent(new CustomEvent('app:login', { detail: payload }));
    });

    passEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitEl.click();
        }
    });

    regLink?.addEventListener('click', () => setState({ view: 'register' }));
}

function renderSessionOptions(byServer, selectedKey) {
    let html = `<option value="">— выбрать —</option>`;

    const servers = Array.from(byServer.keys()).sort((a, b) => a.localeCompare(b));
    for (const srv of servers) {
        const items = byServer.get(srv) || [];
        html += `<optgroup label="${escapeHtml(srv)}">`;

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

function applySessionToInputs(sess, serverEl, loginEl, passEl) {
    serverEl.value = sess.server || '';
    loginEl.value = sess.login || '';
    // если хранишь пароль — можно префиллить
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
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return '';
    }
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
    // value="" в option
    return escapeHtml(str).replace(/`/g, '&#96;');
}
