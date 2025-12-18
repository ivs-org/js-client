// src/ui/login_view.js
import { setState } from '../core/app_state.js';
import { loadStoredCreds } from '../data/storage.js';

export function renderLoginView(root, state) {
    if (!root) return;

    const auth = loadStoredCreds() || {};
    const server = auth.server || '';
    const login = auth.login || '';

    root.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <h1 class="auth-title">Вход в VideoGrace</h1>

          <div class="auth-field">
            <label for="loginServer">Сервер</label>
            <input id="loginServer" type="text"
                   placeholder="wss://server:port/control"
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
            <button type="button" id="lnkOpenRegister" class="link-btn">
              Регистрация
            </button>
          </div>
        </div>
      </div>
    `;

    const serverEl = root.querySelector('#loginServer');
    const loginEl = root.querySelector('#loginLogin');
    const passEl = root.querySelector('#loginPassword');
    const submitEl = root.querySelector('#btnLoginSubmit');
    const regLink = root.querySelector('#lnkOpenRegister');

    if (!serverEl || !loginEl || !passEl || !submitEl) return;

    submitEl.addEventListener('click', () => {
        const payload = {
            server: serverEl.value.trim(),
            login: loginEl.value.trim(),
            password: passEl.value,
        };

        document.dispatchEvent(new CustomEvent('app:login', {
            detail: payload
        }));
    });

    if (regLink) {
        regLink.addEventListener('click', () => {
            // переключаемся на экран регистрации
            setState({
                view: 'register'
            });
        });
    }

    passEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // Предотвращаем лишние действия
            submitEl.click(); // Программный клик по кнопке
        }
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
